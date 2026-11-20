import { randomUUID } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { ConfigService } from "@nestjs/config";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { DataSource } from "typeorm";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { RevenueAnalyticsService } from "../revenue-analytics/revenue-analytics.service";
import { TrekkingRouteStatus } from "../trekking-routes/entities/trekking-route.entity";
import { UserRole } from "../users/entities/user.entity";
import type { CreateHostSuggestionJobDto } from "./dto/create-host-suggestion-job.dto";
import type {
	HostAnalyticsRationaleCode,
	HostSuggestionJobResponseDto,
	HostSuggestionJobStatus,
	HostTripSuggestionItemDto,
	QuickCreateContextResponseDto,
} from "./dto/host-analytics-response.dto";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsAiError, HostAnalyticsAiProvider } from "./host-analytics-ai.provider";
import {
	HOST_ANALYTICS_FORMULA_VERSION,
	HOST_PLANNING_PROMPT_VERSION,
	buildRouteCandidates,
	computeSourceHash,
	mapRationaleLabels,
	resolveAnalyticsWindow,
	validateAiPlanningSelection,
	vietnamDateKey,
} from "./host-analytics.policy";
// biome-ignore lint/style/useImportType: NestJS DI requires runtime metadata
import { HostAnalyticsRepository } from "./host-analytics.repository";

export interface JobRow {
	id: string;
	host_id: string;
	period_from: string | Date;
	period_to: string | Date;
	area_code: string | null;
	status: HostSuggestionJobStatus;
	source_hash: string;
	prompt_version: string;
	attempts: number;
	error_code: string | null;
	lease_token: string | null;
	created_at: string | Date;
	started_at: string | Date | null;
	finished_at: string | Date | null;
}

interface SuggestionRow {
	id: string;
	job_id: string;
	host_id: string;
	route_id: string;
	route_name: string | null;
	area_code: string | null;
	area_name: string | null;
	trip_type: "day_trip" | "overnight";
	month_hint: string;
	price_band: string | null;
	capacity_band: string | null;
	suggested_price_per_person: string | number | null;
	suggested_capacity_min: number | null;
	rationale_codes: HostAnalyticsRationaleCode[];
	missing_data: string[];
	created_at: string | Date;
}

export class HostAnalyticsRateLimitException extends HttpException {
	constructor(
		public readonly retryAfterSeconds: number,
		code: "cooldown_active" | "daily_quota_exceeded",
		message: string
	) {
		super(
			{
				statusCode: HttpStatus.TOO_MANY_REQUESTS,
				error: code,
				message,
				retryAfterSeconds,
			},
			HttpStatus.TOO_MANY_REQUESTS
		);
	}
}

@Injectable()
export class HostAnalyticsSuggestionsService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly configService: ConfigService,
		private readonly revenueAnalyticsService: RevenueAnalyticsService,
		private readonly repository: HostAnalyticsRepository,
		private readonly aiProvider: HostAnalyticsAiProvider
	) {}

	private getCooldownSeconds(): number {
		const raw = Number(this.configService.get<string>("HOST_ANALYTICS_COOLDOWN_SECONDS") ?? 60);
		return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 60;
	}

	private getDailyQuota(): number {
		const raw = Number(this.configService.get<string>("HOST_ANALYTICS_DAILY_QUOTA") ?? 5);
		return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 5;
	}

	private assertHost(user: AuthenticatedUser): void {
		if (!user.roles.includes(UserRole.HOST)) {
			throw new ForbiddenException({
				statusCode: 403,
				error: "FORBIDDEN",
				message: "Chỉ Chủ chuyến (Host) mới có quyền sử dụng gợi ý chuyến đi",
			});
		}
	}

	async computeCurrentSourceHash(
		hostId: string,
		from: Date,
		to: Date,
		areaCode: string | null
	): Promise<string> {
		const hostUser: AuthenticatedUser = {
			userId: hostId,
			roles: [UserRole.HOST],
			status: "active" as AuthenticatedUser["status"],
		};

		const [financial, fp] = await Promise.all([
			this.revenueAnalyticsService.getRevenueAnalytics(hostUser, {
				from: from.toISOString(),
				to: to.toISOString(),
				areaCode: areaCode ?? undefined,
			}),
			this.repository.getHostTripFingerprintData(hostId, from, to, areaCode ?? undefined),
		]);

		return computeSourceHash({
			hostId,
			periodFrom: from.toISOString(),
			periodTo: to.toISOString(),
			areaCode,
			tripIds: fp.tripIds,
			maxTripUpdatedAt: fp.maxUpdatedAt,
			bookingCountsByStatus: fp.bookingCountsByStatus,
			financialTotals: {
				grossRevenue: financial.kpis.grossRevenue,
				refundAmount: financial.kpis.refundAmount,
				platformFee: financial.kpis.platformFee,
				netRevenue: financial.kpis.netRevenue,
				postSettlementRefund: financial.kpis.postSettlementRefund,
			},
			formulaVersion: HOST_ANALYTICS_FORMULA_VERSION,
			promptVersion: HOST_PLANNING_PROMPT_VERSION,
		});
	}

	async createJob(
		user: AuthenticatedUser,
		dto: CreateHostSuggestionJobDto,
		now: Date = new Date()
	): Promise<{ httpStatus: 200 | 202; job: HostSuggestionJobResponseDto }> {
		this.assertHost(user);
		const { from, to } = resolveAnalyticsWindow(dto.from, dto.to, now);
		const areaCode = dto.areaCode?.trim() || null;

		if (areaCode) {
			const exists = await this.repository.areaExists(areaCode);
			if (!exists) {
				throw new UnprocessableEntityException({
					statusCode: 422,
					error: "INVALID_AREA_CODE",
					message: "Khu vực không tồn tại trong hệ thống",
				});
			}
		}

		// Verify eligible candidates exist before consuming quota
		const [activeRoutes, completedTrips] = await Promise.all([
			this.repository.getActiveRoutesWithLatestArea(user.userId),
			this.repository.getCompletedTripsInWindow(user.userId, from, to, areaCode ?? undefined),
		]);
		const candidates = buildRouteCandidates(activeRoutes, completedTrips, areaCode, now);
		if (candidates.length === 0) {
			throw new UnprocessableEntityException({
				statusCode: 422,
				error: "no_eligible_candidates",
				message: "Chưa có tuyến đang hoạt động phù hợp để tạo gợi ý chuyến đi",
			});
		}

		const sourceHash = await this.computeCurrentSourceHash(user.userId, from, to, areaCode);

		// Reuse latest succeeded job with identical source_hash (no quota consumed)
		const reusableRows = await this.dataSource.query<JobRow[]>(
			`SELECT * FROM host_analytics_suggestion_jobs
			 WHERE host_id = $1 AND status = 'succeeded' AND source_hash = $2
			 ORDER BY created_at DESC LIMIT 1`,
			[user.userId, sourceHash]
		);
		if (reusableRows[0]) {
			const jobDto = await this.presentJob(reusableRows[0], false);
			return { httpStatus: 200, job: jobDto };
		}

		const cooldownSeconds = this.getCooldownSeconds();
		const dailyQuota = this.getDailyQuota();
		const todayVn = vietnamDateKey(now);

		const createdOrActive = await this.dataSource.transaction(async (manager) => {
			// Ensure control row exists and lock it per host_id
			await manager.query(
				`INSERT INTO host_analytics_control (host_id, last_created_at, daily_date_vn, daily_count, updated_at)
				 VALUES ($1, NULL, $2::date, 0, now())
				 ON CONFLICT (host_id) DO NOTHING`,
				[user.userId, todayVn]
			);

			const controlRows = await manager.query<
				Array<{
					host_id: string;
					last_created_at: string | Date | null;
					daily_date_vn: string | Date;
					daily_count: number;
				}>
			>(
				"SELECT host_id, last_created_at, daily_date_vn::text AS daily_date_vn, daily_count FROM host_analytics_control WHERE host_id = $1 FOR UPDATE",
				[user.userId]
			);
			const control = controlRows[0];

			// Check active job (queued | running)
			const activeRows = await manager.query<JobRow[]>(
				`SELECT * FROM host_analytics_suggestion_jobs
				 WHERE host_id = $1 AND status IN ('queued', 'running')
				 LIMIT 1`,
				[user.userId]
			);
			if (activeRows[0]) {
				const active = activeRows[0];
				const sameParams =
					new Date(active.period_from).toISOString() === from.toISOString() &&
					new Date(active.period_to).toISOString() === to.toISOString() &&
					(active.area_code ?? null) === areaCode;
				if (sameParams) {
					return active;
				}
				throw new ConflictException({
					statusCode: 409,
					error: "active_job_different_params",
					message: "Bạn đang có một yêu cầu tạo gợi ý khác đang xử lý",
					activeJob: {
						id: active.id,
						status: active.status,
						periodFrom: new Date(active.period_from).toISOString(),
						periodTo: new Date(active.period_to).toISOString(),
						areaCode: active.area_code,
					},
				});
			}

			// Enforce per-host cooldown
			if (control.last_created_at && cooldownSeconds > 0) {
				const elapsedSec = (now.getTime() - new Date(control.last_created_at).getTime()) / 1000;
				const remaining = Math.ceil(cooldownSeconds - elapsedSec);
				if (remaining > 0) {
					throw new HostAnalyticsRateLimitException(
						remaining,
						"cooldown_active",
						`Vui lòng chờ ${remaining} giây trước khi tạo gợi ý mới`
					);
				}
			}

			// Enforce per-host daily quota (Vietnam date)
			const storedDate = String(control.daily_date_vn).slice(0, 10);
			const currentDailyCount = storedDate === todayVn ? Number(control.daily_count) : 0;
			if (currentDailyCount >= dailyQuota) {
				const secondsUntilMidnight = this.secondsUntilVietnamMidnight(now);
				throw new HostAnalyticsRateLimitException(
					secondsUntilMidnight,
					"daily_quota_exceeded",
					`Bạn đã đạt giới hạn ${dailyQuota} lần tạo gợi ý trong ngày`
				);
			}

			await manager.query(
				`UPDATE host_analytics_control
				 SET last_created_at = $2,
				     daily_date_vn = $3::date,
				     daily_count = $4,
				     updated_at = now()
				 WHERE host_id = $1`,
				[user.userId, now.toISOString(), todayVn, currentDailyCount + 1]
			);

			const inserted = await manager.query<JobRow[]>(
				`INSERT INTO host_analytics_suggestion_jobs (
					host_id, period_from, period_to, area_code, status, source_hash, prompt_version
				) VALUES ($1, $2, $3, $4, 'queued', $5, $6)
				RETURNING *`,
				[
					user.userId,
					from.toISOString(),
					to.toISOString(),
					areaCode,
					sourceHash,
					HOST_PLANNING_PROMPT_VERSION,
				]
			);
			return inserted[0];
		});

		const jobDto = await this.presentJob(createdOrActive, false);
		return { httpStatus: 202, job: jobDto };
	}

	async getLatestJob(user: AuthenticatedUser): Promise<HostSuggestionJobResponseDto> {
		this.assertHost(user);
		const rows = await this.dataSource.query<JobRow[]>(
			`SELECT * FROM host_analytics_suggestion_jobs
			 WHERE host_id = $1
			 ORDER BY created_at DESC LIMIT 1`,
			[user.userId]
		);
		if (!rows[0]) {
			throw new NotFoundException({
				statusCode: 404,
				error: "SUGGESTION_JOB_NOT_FOUND",
				message: "Chưa có gợi ý chuyến đi nào được tạo",
			});
		}
		return this.presentJobWithFreshStale(rows[0]);
	}

	async getJobById(user: AuthenticatedUser, jobId: string): Promise<HostSuggestionJobResponseDto> {
		this.assertHost(user);
		const rows = await this.dataSource.query<JobRow[]>(
			"SELECT * FROM host_analytics_suggestion_jobs WHERE id = $1 AND host_id = $2",
			[jobId, user.userId]
		);
		if (!rows[0]) {
			throw new NotFoundException({
				statusCode: 404,
				error: "SUGGESTION_JOB_NOT_FOUND",
				message: "Không tìm thấy yêu cầu gợi ý chuyến đi",
			});
		}
		return this.presentJobWithFreshStale(rows[0]);
	}

	async getQuickCreateContext(
		user: AuthenticatedUser,
		suggestionId: string
	): Promise<QuickCreateContextResponseDto> {
		this.assertHost(user);
		const rows = await this.dataSource.query<
			Array<{
				id: string;
				host_id: string;
				route_id: string;
				area_code: string | null;
				trip_type: "day_trip" | "overnight";
				month_hint: string;
				suggested_price_per_person: string | number | null;
				suggested_capacity_min: number | null;
			}>
		>(
			`SELECT id, host_id, route_id, area_code, trip_type, month_hint,
			        suggested_price_per_person, suggested_capacity_min
			 FROM host_trip_suggestions
			 WHERE id = $1 AND host_id = $2`,
			[suggestionId, user.userId]
		);

		const suggestion = rows[0];
		if (!suggestion) {
			throw new NotFoundException({
				statusCode: 404,
				error: "SUGGESTION_NOT_FOUND",
				message: "Không tìm thấy gợi ý chuyến đi",
			});
		}

		const route = await this.repository.getRouteStatusForHost(suggestion.route_id);
		if (!route || route.hostId !== user.userId) {
			throw new ConflictException({
				statusCode: 409,
				error: "route_not_owned",
				message: "Tuyến trekking không còn thuộc quyền sở hữu của bạn",
			});
		}
		if (route.status !== TrekkingRouteStatus.ACTIVE) {
			throw new ConflictException({
				statusCode: 409,
				error: "route_not_active",
				message: "Tuyến trekking hiện không ở trạng thái đang hoạt động",
			});
		}

		if (suggestion.area_code) {
			const activeArea = await this.repository.isAreaActive(suggestion.area_code);
			if (!activeArea) {
				throw new ConflictException({
					statusCode: 409,
					error: "area_inactive",
					message: "Khu vực của gợi ý này hiện không còn hoạt động",
				});
			}
		}

		return {
			valid: true,
			prefill: {
				routeId: suggestion.route_id,
				areaCode: suggestion.area_code,
				tripType: suggestion.trip_type,
				pricePerPerson:
					suggestion.suggested_price_per_person !== null
						? Number(suggestion.suggested_price_per_person)
						: null,
				capacityMin:
					suggestion.suggested_capacity_min !== null
						? Number(suggestion.suggested_capacity_min)
						: null,
				suggestedMonth: suggestion.month_hint,
			},
		};
	}

	async processNextJob(now: Date = new Date()): Promise<boolean> {
		const leaseToken = randomUUID();
		const claimed = await this.dataSource.transaction(async (manager) => {
			const rows = await manager.query<JobRow[]>(
				`SELECT * FROM host_analytics_suggestion_jobs
				 WHERE (status = 'queued' AND (next_attempt_at IS NULL OR next_attempt_at <= $1))
				    OR (status = 'running' AND lease_until IS NOT NULL AND lease_until < $1)
				 ORDER BY created_at ASC
				 LIMIT 1
				 FOR UPDATE SKIP LOCKED`,
				[now.toISOString()]
			);
			const job = rows[0];
			if (!job) return null;

			const updatedRaw = await manager.query<unknown>(
				`UPDATE host_analytics_suggestion_jobs
				 SET status = 'running',
				     attempts = attempts + 1,
				     lease_token = $2,
				     lease_until = $3,
				     started_at = COALESCE(started_at, $1)
				 WHERE id = $4
				 RETURNING *`,
				[now.toISOString(), leaseToken, new Date(now.getTime() + 60_000).toISOString(), job.id]
			);
			const updatedRows = this.unwrapReturning<JobRow>(updatedRaw);
			return updatedRows[0] ?? null;
		});

		if (!claimed) return false;

		try {
			const from = new Date(claimed.period_from);
			const to = new Date(claimed.period_to);
			const [activeRoutes, completedTrips] = await Promise.all([
				this.repository.getActiveRoutesWithLatestArea(claimed.host_id),
				this.repository.getCompletedTripsInWindow(
					claimed.host_id,
					from,
					to,
					claimed.area_code ?? undefined
				),
			]);
			const candidates = buildRouteCandidates(
				activeRoutes,
				completedTrips,
				claimed.area_code ?? null,
				now
			);
			if (candidates.length === 0) {
				await this.failJob(claimed, leaseToken, "no_eligible_candidates", false);
				return true;
			}

			const aiResponse = await this.aiProvider.generatePlanningSelections(candidates);
			const validated = validateAiPlanningSelection(candidates, aiResponse.selections);
			if (validated.length === 0) {
				await this.failJob(claimed, leaseToken, "analysis_unavailable", true);
				return true;
			}

			const byId = new Map(candidates.map((c) => [c.candidateId, c]));

			await this.dataSource.transaction(async (manager) => {
				const lockCheck = await manager.query<Array<{ id: string }>>(
					"SELECT id FROM host_analytics_suggestion_jobs WHERE id = $1 AND lease_token = $2 FOR UPDATE",
					[claimed.id, leaseToken]
				);
				if (!lockCheck[0]) return;

				await manager.query("DELETE FROM host_trip_suggestions WHERE job_id = $1", [claimed.id]);

				for (const item of validated) {
					const cand = byId.get(item.candidateId);
					if (!cand) continue;
					await manager.query(
						`INSERT INTO host_trip_suggestions (
							job_id, host_id, route_id, area_code, trip_type, month_hint,
							price_band, capacity_band, suggested_price_per_person, suggested_capacity_min,
							rationale_codes, missing_data
						) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb)`,
						[
							claimed.id,
							claimed.host_id,
							cand.routeId,
							cand.areaCode,
							cand.tripType,
							item.monthHint,
							cand.priceBand,
							cand.capacityBand,
							cand.suggestedPricePerPerson,
							cand.suggestedCapacityMin,
							JSON.stringify(item.rationaleCodes),
							JSON.stringify(cand.missingData),
						]
					);
				}

				await manager.query(
					`UPDATE host_analytics_suggestion_jobs
					 SET status = 'succeeded',
					     error_code = NULL,
					     lease_token = NULL,
					     lease_until = NULL,
					     finished_at = now()
					 WHERE id = $1`,
					[claimed.id]
				);
			});
		} catch (error) {
			const aiErr = error instanceof HostAnalyticsAiError ? error : null;
			const retryable = aiErr ? aiErr.retryable : true;
			const attempts = Number(claimed.attempts);
			if (retryable && attempts < 3) {
				const backoffMs = attempts === 1 ? 5_000 : 30_000;
				await this.dataSource.query(
					`UPDATE host_analytics_suggestion_jobs
					 SET status = 'queued',
					     lease_token = NULL,
					     lease_until = NULL,
					     next_attempt_at = $2,
					     error_code = 'analysis_unavailable'
					 WHERE id = $1 AND lease_token = $3`,
					[claimed.id, new Date(Date.now() + backoffMs).toISOString(), leaseToken]
				);
			} else {
				await this.failJob(claimed, leaseToken, "analysis_unavailable", true);
			}
		}

		return true;
	}

	private async failJob(
		job: JobRow,
		leaseToken: string,
		errorCode: string,
		refundDailyQuota: boolean
	): Promise<void> {
		const jobCreatedDateVn = vietnamDateKey(new Date(job.created_at));
		await this.dataSource.transaction(async (manager) => {
			const updatedRaw = await manager.query<unknown>(
				`UPDATE host_analytics_suggestion_jobs
				 SET status = 'failed',
				     error_code = $2,
				     lease_token = NULL,
				     lease_until = NULL,
				     finished_at = now()
				 WHERE id = $1 AND lease_token = $3
				 RETURNING id`,
				[job.id, errorCode, leaseToken]
			);
			const updatedRows = this.unwrapReturning<{ id: string }>(updatedRaw);
			if (!updatedRows[0]) return;

			if (refundDailyQuota && errorCode === "analysis_unavailable") {
				await manager.query(
					`UPDATE host_analytics_control
					 SET daily_count = GREATEST(daily_count - 1, 0),
					     updated_at = now()
					 WHERE host_id = $1 AND daily_date_vn = $2::date`,
					[job.host_id, jobCreatedDateVn]
				);
			}
		});
	}

	private async presentJobWithFreshStale(job: JobRow): Promise<HostSuggestionJobResponseDto> {
		const currentHash = await this.computeCurrentSourceHash(
			job.host_id,
			new Date(job.period_from),
			new Date(job.period_to),
			job.area_code ?? null
		);
		return this.presentJob(job, currentHash !== job.source_hash);
	}

	private async presentJob(job: JobRow, stale: boolean): Promise<HostSuggestionJobResponseDto> {
		const rows = await this.dataSource.query<SuggestionRow[]>(
			`SELECT s.*, r.name AS route_name, g.name AS area_name
			 FROM host_trip_suggestions s
			 LEFT JOIN trekking_routes r ON r.id = s.route_id
			 LEFT JOIN geo_areas g ON g.code = s.area_code
			 WHERE s.job_id = $1
			 ORDER BY s.created_at ASC`,
			[job.id]
		);

		const suggestions: HostTripSuggestionItemDto[] = rows.map((row) => {
			const codes = Array.isArray(row.rationale_codes) ? row.rationale_codes : [];
			return {
				id: row.id,
				routeId: row.route_id,
				routeName: row.route_name ?? null,
				areaCode: row.area_code,
				areaName: row.area_name ?? null,
				tripType: row.trip_type,
				monthHint: row.month_hint,
				priceBand: row.price_band,
				capacityBand: row.capacity_band,
				suggestedPricePerPerson:
					row.suggested_price_per_person !== null ? Number(row.suggested_price_per_person) : null,
				suggestedCapacityMin:
					row.suggested_capacity_min !== null ? Number(row.suggested_capacity_min) : null,
				rationaleCodes: codes,
				rationaleLabels: mapRationaleLabels(codes),
				missingData: Array.isArray(row.missing_data) ? row.missing_data : [],
				createdAt: new Date(row.created_at).toISOString(),
			};
		});

		return {
			id: job.id,
			status: job.status,
			periodFrom: new Date(job.period_from).toISOString(),
			periodTo: new Date(job.period_to).toISOString(),
			areaCode: job.area_code,
			promptVersion: job.prompt_version,
			errorCode: job.error_code,
			stale,
			createdAt: new Date(job.created_at).toISOString(),
			startedAt: job.started_at ? new Date(job.started_at).toISOString() : null,
			finishedAt: job.finished_at ? new Date(job.finished_at).toISOString() : null,
			suggestions,
		};
	}

	private unwrapReturning<T>(result: unknown): T[] {
		if (!Array.isArray(result)) return [];
		if (Array.isArray(result[0])) {
			return result[0] as T[];
		}
		return result as T[];
	}

	private secondsUntilVietnamMidnight(now: Date): number {
		const vnTime = new Date(now.getTime() + 7 * 3600 * 1000);
		const elapsedTodaySec =
			vnTime.getUTCHours() * 3600 + vnTime.getUTCMinutes() * 60 + vnTime.getUTCSeconds();
		return Math.max(1, 86400 - elapsedTodaySec);
	}
}
