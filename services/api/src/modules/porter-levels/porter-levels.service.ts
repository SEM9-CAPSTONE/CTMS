import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { normalizeStringArray } from "../profiles/dto/normalized-string-array.validator";
import { PorterRouteProficiency } from "../profiles/entities/porter-route-qualification.entity";
import { PorterVerificationStatus } from "../profiles/entities/porter-verification.entity";
import { UserRole } from "../users/entities/user.entity";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { LevelNotificationsService } from "./level-notifications.service";
import type { RequestEvidence } from "./level-requests.types";
import {
	computeLevelProgressPercent,
	evaluateLevelCriteria,
	getVietnamDateString,
	levelDossierHash,
} from "./porter-level-comparison";
import type {
	DecideGlobalPorterLevelDto,
	DecidePorterLevelDto,
	NotifyPorterLevelGapsDto,
	SaveLevelEvidenceDto,
	SaveLevelPolicyDto,
} from "./porter-levels.dto";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { PorterLevelsRepository } from "./porter-levels.repository";
import {
	type GlobalPorterLevelAlert,
	type GlobalPorterLevelEvaluation,
	type GlobalPorterLevelOverview,
	type GlobalPorterSummaryItem,
	type LevelDecision,
	LevelDecisionOutcome,
	type LevelDefinition,
	type LevelDossier,
	type LevelEvidence,
	type LevelPolicy,
} from "./porter-levels.types";

const HISTORY_SELECT = `SELECT id, qualification_id AS "qualificationId", porter_id AS "porterId",
	 route_id AS "routeId", actor_id AS "actorId", outcome, from_level AS "fromLevel", to_level AS "toLevel",
	 (SELECT full_name FROM users u WHERE u.id=actor_id) AS "actorName",(SELECT name FROM trekking_routes r WHERE r.id=route_id) AS "routeName",
	 reason, policy_snapshot AS "policySnapshot", dossier_snapshot AS "dossierSnapshot",
	 comparison_snapshot AS "comparisonSnapshot",source,request_id AS "requestId",action,from_verified AS "fromVerified",to_verified AS "toVerified",evidence_snapshot AS "evidenceSnapshot",porter_reason AS "porterReason", decided_at AS "decidedAt" FROM porter_level_decisions`;

@Injectable()
export class PorterLevelsService {
	constructor(
		private readonly repository: PorterLevelsRepository,
		private readonly notifications: LevelNotificationsService
	) {}

	policies(): Promise<LevelPolicy[]> {
		return this.repository.policies();
	}
	list(page: number, limit: number, search?: string) {
		return this.repository.list(page, limit, search);
	}
	mine(porterId: string) {
		return this.repository.mine(porterId);
	}

	async savePolicy(
		actorId: string,
		level: PorterRouteProficiency,
		dto: SaveLevelPolicyDto
	): Promise<LevelPolicy> {
		return this.repository.dataSource.transaction(async (manager) => {
			await this.repository.requireRole(manager, actorId, UserRole.ADMIN);
			// Serialize even the first insert without assigning any default criteria.
			await manager.query(
				"SELECT pg_advisory_xact_lock(hashtext('porter-level-policy'),hashtext($1))",
				[level]
			);
			const current = await this.repository.policy(manager, level);
			if ((current?.version ?? 0) !== dto.expectedVersion)
				throw new ConflictException("Criteria changed; reload before saving");
			const definition: LevelDefinition = {
				name: dto.name,
				minExperienceYears: dto.minExperienceYears,
				minTimesLed: dto.minTimesLed,
				minCompletedTrips: dto.minCompletedTrips ?? dto.minTimesLed,
				minTotalKm: dto.minTotalKm ?? null,
				minAverageRating: dto.minAverageRating ?? null,
				requiredSkills: normalizeStringArray(dto.requiredSkills),
				requiredCertifications: normalizeStringArray(dto.requiredCertifications),
				responsibilities: dto.responsibilities,
			};
			const rows = (await manager.query(
				`INSERT INTO porter_level_policies(level,definition,version,updated_by)
			 VALUES($1,$2::jsonb,1,$3) ON CONFLICT(level) DO UPDATE SET definition=EXCLUDED.definition,
			 version=porter_level_policies.version+1,updated_by=EXCLUDED.updated_by,updated_at=now()
			 RETURNING level,definition,version,updated_by AS "updatedBy",updated_at AS "updatedAt"`,
				[level, JSON.stringify(definition), actorId]
			)) as LevelPolicy[];
			await this.repository.audit(manager, actorId, "porter_level.policy_updated", actorId, {
				level,
				before: current,
				after: rows[0],
			});
			return rows[0];
		});
	}

	async evidence(porterId: string): Promise<LevelEvidence> {
		const rows = (await this.repository.dataSource.query(
			"SELECT skills,version FROM porter_level_evidence WHERE porter_id=$1",
			[porterId]
		)) as LevelEvidence[];
		return rows[0] ?? { skills: [], version: 0 };
	}

	async saveEvidence(porterId: string, dto: SaveLevelEvidenceDto): Promise<LevelEvidence> {
		return this.repository.dataSource.transaction(async (manager) => {
			await manager.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [porterId]);
			await this.repository.requireRole(manager, porterId, UserRole.PORTER);
			const current = (await manager.query(
				"SELECT version FROM porter_level_evidence WHERE porter_id=$1",
				[porterId]
			)) as Array<{ version: number }>;
			if ((current[0]?.version ?? 0) !== dto.expectedVersion)
				throw new ConflictException("Skills changed; reload before saving");
			const rows = (await manager.query(
				`INSERT INTO porter_level_evidence(porter_id,skills,version)
			 VALUES($1,$2,1) ON CONFLICT(porter_id) DO UPDATE SET skills=EXCLUDED.skills,
			 version=porter_level_evidence.version+1,updated_at=now() RETURNING skills,version`,
				[porterId, normalizeStringArray(dto.skills)]
			)) as LevelEvidence[];
			await this.repository.audit(manager, porterId, "porter_level.skills_updated", porterId, {
				version: rows[0].version,
			});
			return rows[0];
		});
	}

	async comparison(qualificationId: string, level: PorterRouteProficiency) {
		return this.repository.dataSource.transaction(async (manager) => {
			const identity = await this.repository.qualification(manager, qualificationId);
			await this.repository.lockDossier(manager, identity);
			const qualification = await this.repository.qualification(manager, qualificationId);
			const dossier = await this.repository.dossier(manager, qualification);
			const policy = await this.repository.policy(manager, level, true);
			const open = (await manager.query(
				"SELECT id FROM porter_level_requests WHERE qualification_id=$1 AND status IN ('pending','needs_info')",
				[qualificationId]
			)) as Array<{ id: string }>;
			return {
				qualification,
				dossier,
				dossierHash: levelDossierHash(dossier),
				policy,
				comparison: null,
				openRequestId: open[0]?.id ?? null,
			};
		});
	}

	async decide(
		actorId: string,
		qualificationId: string,
		dto: DecidePorterLevelDto
	): Promise<LevelDecision> {
		return this.repository.dataSource.transaction((manager) =>
			this.applyDecision(manager, actorId, qualificationId, dto)
		);
	}

	async applyDecision(
		manager: EntityManager,
		actorId: string,
		qualificationId: string,
		dto: DecidePorterLevelDto,
		request?: { id: string; evidence: RequestEvidence[]; porterReason: string }
	): Promise<LevelDecision> {
		await this.repository.requireRole(manager, actorId, UserRole.ADMIN);
		const identity = await this.repository.qualification(manager, qualificationId);
		if (identity.porterId === actorId)
			throw new ForbiddenException("An Admin cannot review their own Porter level");
		await this.repository.lockDossier(manager, identity);
		await this.repository.requireRole(manager, identity.porterId, UserRole.PORTER);
		const qualification = await this.repository.qualification(manager, qualificationId);
		if (!request) {
			await this.repository.assertNoOpenRequest(manager, qualificationId);
			if (
				dto.outcome === LevelDecisionOutcome.APPROVED &&
				qualification.verifiedBy &&
				qualification.proficiency === dto.level
			)
				throw new ConflictException({
					code: "NO_LEVEL_CHANGE",
					message: "Cấp này đã được xác minh, không có thay đổi.",
				});
		}
		const dossier = await this.repository.dossier(manager, qualification);
		const policy = await this.repository.policy(manager, dto.level, true);
		if (!policy)
			throw new ConflictException("Admin must configure the target level criteria before review");
		if (
			qualification.version !== dto.expectedQualificationVersion ||
			policy.version !== dto.expectedPolicyVersion ||
			levelDossierHash(dossier) !== dto.expectedDossierHash
		) {
			throw new ConflictException(
				"Profile, qualification or criteria changed; review the latest evidence again"
			);
		}
		if (
			dto.outcome === LevelDecisionOutcome.APPROVED &&
			dossier.verificationStatus !== PorterVerificationStatus.APPROVED
		) {
			throw new ConflictException(
				"Porter certificate verification must be approved before a level is approved"
			);
		}
		const comparison = null;
		// Deliberately no automatic promotion or threshold gate: Admin makes the decision and gives a reason.
		await manager.query(
			`UPDATE porter_route_qualifications SET
			 proficiency=CASE WHEN $2 THEN $3::porter_route_proficiency ELSE proficiency END,
			 verified_by=CASE WHEN $2 THEN $4::uuid ELSE verified_by END,
			 verified_at=CASE WHEN $2 THEN now() ELSE verified_at END,version=version+1,updated_at=now() WHERE id=$1`,
			[qualificationId, dto.outcome === LevelDecisionOutcome.APPROVED, dto.level, actorId]
		);
		const inserted = (await manager.query(
			`INSERT INTO porter_level_decisions
			 (qualification_id,porter_id,route_id,actor_id,outcome,from_level,to_level,reason,
			 policy_snapshot,dossier_snapshot,comparison_snapshot)
			 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb) RETURNING id`,
			[
				qualificationId,
				identity.porterId,
				identity.routeId,
				actorId,
				dto.outcome,
				qualification.proficiency,
				dto.level,
				dto.reason,
				JSON.stringify(policy),
				JSON.stringify(dossier),
				JSON.stringify(comparison),
			]
		)) as Array<{ id: string }>;
		const rank = { learning: 0, proficient: 1, expert: 2 };
		let action = "recognize";
		if (
			dto.outcome === LevelDecisionOutcome.APPROVED &&
			rank[dto.level] > rank[qualification.proficiency]
		)
			action = "upgrade";
		if (
			dto.outcome === LevelDecisionOutcome.APPROVED &&
			rank[dto.level] < rank[qualification.proficiency]
		)
			action = "downgrade";
		await manager.query(
			"UPDATE porter_level_decisions SET source=$2,request_id=$3,action=$4,from_verified=$5,to_verified=$8,evidence_snapshot=$6::jsonb,porter_reason=$7 WHERE id=$1",
			[
				inserted[0].id,
				request ? "request" : "direct",
				request?.id ?? null,
				action,
				Boolean(qualification.verifiedBy),
				JSON.stringify(request?.evidence ?? []),
				request?.porterReason ?? null,
				dto.outcome === LevelDecisionOutcome.APPROVED || Boolean(qualification.verifiedBy),
			]
		);
		await this.notifications.enqueue(manager, identity.porterId, {
			kind:
				dto.outcome === LevelDecisionOutcome.REJECTED ? "rejected" : request ? "approved" : action,
			requestId: request?.id,
			qualificationId,
			routeId: identity.routeId,
			routeName: identity.routeName,
			level: dto.level,
			reason: dto.reason,
		});
		await this.repository.audit(manager, actorId, "porter_level.reviewed", inserted[0].id, {
			qualificationId,
			porterId: identity.porterId,
			routeId: identity.routeId,
			outcome: dto.outcome,
			toLevel: dto.level,
			policyVersion: policy.version,
		});
		const rows = (await manager.query(`${HISTORY_SELECT} WHERE id=$1`, [
			inserted[0].id,
		])) as LevelDecision[];
		return rows[0];
	}

	async decisionForRequest(
		manager: EntityManager,
		requestId: string
	): Promise<LevelDecision | null> {
		const rows = (await manager.query(`${HISTORY_SELECT} WHERE request_id=$1`, [
			requestId,
		])) as LevelDecision[];
		return rows[0] ?? null;
	}
	async history(qualificationId: string): Promise<LevelDecision[]> {
		return this.repository.dataSource.query(
			`${HISTORY_SELECT} WHERE qualification_id=$1 ORDER BY decided_at DESC,id DESC LIMIT 100`,
			[qualificationId]
		);
	}
	async ownHistory(porterId: string): Promise<LevelDecision[]> {
		return this.repository.dataSource.query(
			`${HISTORY_SELECT} WHERE porter_id=$1 ORDER BY decided_at DESC,id DESC LIMIT 100`,
			[porterId]
		);
	}

	async getGlobalOverview(
		porterId: string,
		now: Date = new Date()
	): Promise<GlobalPorterLevelOverview> {
		const [row, policies] = await Promise.all([
			this.repository.getGlobalPorterRow(porterId),
			this.repository.policies(),
		]);

		if (!row) {
			throw new NotFoundException("Không tìm thấy hồ sơ người hỗ trợ");
		}

		const policyByLevel = new Map(policies.map((p) => [p.level, p]));
		const orderedLevels: PorterRouteProficiency[] = [
			PorterRouteProficiency.LEARNING,
			PorterRouteProficiency.PROFICIENT,
			PorterRouteProficiency.EXPERT,
		];

		const dossier: LevelDossier = {
			porterId: row.porterId,
			porterName: row.porterName,
			profileVersion: row.profileVersion,
			experienceYears: row.experienceYears,
			certifications: row.certifications,
			certificates: row.certificates,
			skills: row.skills,
			evidenceVersion: row.evidenceVersion,
			verificationStatus: row.verificationStatus,
			verificationUpdatedAt: row.verificationUpdatedAt,
			timesLed: row.completedTrips,
			completedTrips: row.completedTrips,
			totalKmLed: row.totalKmLed,
			averageRating: row.averageRating,
			reviewCount: row.reviewCount,
		};

		const levels: GlobalPorterLevelEvaluation[] = orderedLevels.map((lvl) => {
			const policy = policyByLevel.get(lvl) ?? null;
			const comparison = policy ? evaluateLevelCriteria(dossier, policy.definition, now) : null;
			const progressPercent =
				policy && comparison
					? computeLevelProgressPercent(dossier, policy.definition, comparison)
					: 0;
			return { level: lvl, policy, comparison, progressPercent };
		});

		const currentIdx = orderedLevels.indexOf(row.currentLevel);
		const nextLevel =
			currentIdx >= 0 && currentIdx < orderedLevels.length - 1
				? orderedLevels[currentIdx + 1]
				: null;
		const nextLevelEvaluation = nextLevel
			? (levels.find((l) => l.level === nextLevel) ?? null)
			: null;

		const todayStr = getVietnamDateString(now);
		const in30DaysStr = getVietnamDateString(new Date(now.getTime() + 30 * 86_400_000));
		const verifiedCertificatesCount = row.certificates.filter((c) => {
			if (c.status !== "verified") return false;
			if (!c.expiryDate) return true;
			const exp =
				typeof c.expiryDate === "string"
					? c.expiryDate.slice(0, 10)
					: getVietnamDateString(c.expiryDate);
			return exp >= todayStr;
		}).length;

		const alerts: GlobalPorterLevelAlert[] = [];

		// Certificate expiry warnings
		for (const cert of row.certificates) {
			if (cert.status !== "verified" || !cert.expiryDate) continue;
			const exp =
				typeof cert.expiryDate === "string"
					? cert.expiryDate.slice(0, 10)
					: getVietnamDateString(cert.expiryDate);
			if (exp < todayStr) {
				alerts.push({
					type: "cert_expired",
					severity: "warning",
					title: `Chứng chỉ ${cert.name} đã hết hạn`,
					message: "Vui lòng gia hạn và tải lên bản mới để đảm bảo điều kiện xét cấp bậc.",
				});
			} else if (exp <= in30DaysStr) {
				alerts.push({
					type: "cert_expiring",
					severity: "warning",
					title: `Chứng chỉ ${cert.name} sắp hết hạn (${exp})`,
					message:
						"Hãy chuẩn bị gia hạn chứng chỉ trong 30 ngày tới để không bị gián đoạn xét cấp.",
				});
			}
		}

		// Next level eligibility or missing criteria alert
		if (nextLevelEvaluation?.comparison && nextLevelEvaluation.policy) {
			const nextName = nextLevelEvaluation.policy.definition.name;
			if (nextLevelEvaluation.comparison.allMet) {
				alerts.push({
					type: "eligible_upgrade",
					severity: "success",
					title: `Bạn đã đủ tiêu chí lên cấp ${nextName}`,
					message:
						"Toàn bộ điều kiện về số chuyến, quãng đường, điểm đánh giá và chứng chỉ đều đã đạt. Bạn có thể gửi yêu cầu để Quản trị viên xét duyệt.",
				});
			} else {
				const missing = nextLevelEvaluation.comparison.missingItems ?? [];
				if (missing.length > 0) {
					alerts.push({
						type: "missing_criteria",
						severity: "info",
						title: `Còn thiếu ${missing.length} tiêu chí để lên cấp ${nextName}`,
						message: missing.map((m) => m.label).join(" · "),
					});
				}
			}
		}

		return {
			porterId: row.porterId,
			porterName: row.porterName,
			porterEmail: row.porterEmail,
			currentLevel: row.currentLevel,
			levelVerifiedAt: row.levelVerifiedAt ? new Date(row.levelVerifiedAt).toISOString() : null,
			metrics: {
				completedTrips: row.completedTrips,
				totalKmLed: row.totalKmLed,
				averageRating: row.averageRating,
				reviewCount: row.reviewCount,
				experienceYears: row.experienceYears,
				verifiedCertificatesCount,
				distinctRoutesCount: row.distinctRoutesCount,
			},
			certificates: row.certificates,
			skills: row.skills,
			nextLevel,
			nextLevelEvaluation,
			levels,
			alerts,
		};
	}

	async listGlobalPorters(
		page: number,
		limit: number,
		search?: string
	): Promise<{ items: GlobalPorterSummaryItem[]; total: number }> {
		const { ids, total } = await this.repository.listGlobalPorterIds(page, limit, search);
		const overviews = await Promise.all(ids.map((id) => this.getGlobalOverview(id)));

		const items: GlobalPorterSummaryItem[] = overviews.map((ov) => ({
			porterId: ov.porterId,
			porterName: ov.porterName ?? "Chưa cập nhật tên",
			porterEmail: ov.porterEmail ?? "",
			currentLevel: ov.currentLevel,
			levelVerifiedAt: ov.levelVerifiedAt,
			completedTrips: ov.metrics.completedTrips,
			totalKmLed: ov.metrics.totalKmLed,
			averageRating: ov.metrics.averageRating,
			reviewCount: ov.metrics.reviewCount,
			experienceYears: ov.metrics.experienceYears,
			verifiedCertificatesCount: ov.metrics.verifiedCertificatesCount,
			nextLevel: ov.nextLevel,
			nextLevelAllMet: ov.nextLevelEvaluation?.comparison?.allMet ?? false,
			nextLevelProgressPercent: ov.nextLevelEvaluation?.progressPercent ?? 100,
			missingItems: ov.nextLevelEvaluation?.comparison?.missingItems ?? [],
		}));

		return { items, total };
	}

	async decideGlobalLevel(
		actorId: string,
		porterId: string,
		dto: DecideGlobalPorterLevelDto
	): Promise<GlobalPorterLevelOverview> {
		if (porterId === actorId) {
			throw new ForbiddenException("Quản trị viên không thể tự xét cấp cho chính mình");
		}

		const beforeOverview = await this.getGlobalOverview(porterId);

		await this.repository.dataSource.transaction(async (manager) => {
			await this.repository.requireRole(manager, actorId, UserRole.ADMIN);

			await manager.query(
				`INSERT INTO porter_profiles (porter_id, porter_level, level_verified_by, level_verified_at)
				 VALUES ($1, $2, $3, now())
				 ON CONFLICT (porter_id) DO UPDATE
				 SET porter_level = CASE WHEN $4 = 'approved' THEN EXCLUDED.porter_level ELSE porter_profiles.porter_level END,
				     level_verified_by = CASE WHEN $4 = 'approved' THEN EXCLUDED.level_verified_by ELSE porter_profiles.level_verified_by END,
				     level_verified_at = CASE WHEN $4 = 'approved' THEN now() ELSE porter_profiles.level_verified_at END,
				     updated_at = now()`,
				[porterId, dto.targetLevel, actorId, dto.outcome]
			);

			const rank: Record<PorterRouteProficiency, number> = {
				[PorterRouteProficiency.LEARNING]: 0,
				[PorterRouteProficiency.PROFICIENT]: 1,
				[PorterRouteProficiency.EXPERT]: 2,
			};
			const action =
				dto.outcome === LevelDecisionOutcome.REJECTED
					? "rejected"
					: rank[dto.targetLevel] > rank[beforeOverview.currentLevel]
						? "upgrade"
						: rank[dto.targetLevel] < rank[beforeOverview.currentLevel]
							? "downgrade"
							: "recognize";

			await this.notifications.enqueue(manager, porterId, {
				kind: action,
				routeName: "Cấp bậc tổng quát",
				level: dto.targetLevel,
				reason: dto.reason,
			});

			await this.repository.audit(manager, actorId, "porter_level.global_decided", porterId, {
				porterId,
				fromLevel: beforeOverview.currentLevel,
				toLevel: dto.targetLevel,
				outcome: dto.outcome,
				reason: dto.reason,
			});
		});

		await this.notifications.dispatch().catch(() => undefined);
		return this.getGlobalOverview(porterId);
	}

	async notifyPorterGaps(
		actorId: string,
		porterId: string,
		dto: NotifyPorterLevelGapsDto
	): Promise<{ sent: true; missingCount: number; message: string }> {
		const overview = await this.getGlobalOverview(porterId);
		const targetName = overview.nextLevelEvaluation?.policy?.definition.name ?? "cấp tiếp theo";
		const missing = overview.nextLevelEvaluation?.comparison?.missingItems ?? [];

		const summaryText =
			missing.length > 0
				? `Để đạt cấp ${targetName}, bạn còn thiếu: ${missing.map((m) => m.label).join("; ")}.${dto.customNote ? ` Ghi chú: ${dto.customNote}` : ""}`
				: dto.customNote ||
					`Bạn đã đủ toàn bộ tiêu chí để lên cấp ${targetName}. Hãy gửi yêu cầu xét duyệt!`;

		await this.repository.dataSource.transaction(async (manager) => {
			await this.repository.requireRole(manager, actorId, UserRole.ADMIN);
			await this.notifications.enqueue(manager, porterId, {
				kind: "needs_info",
				routeName: "Cấp bậc tổng quát",
				level: overview.nextLevel ?? overview.currentLevel,
				reason: summaryText,
			});
			await this.repository.audit(manager, actorId, "porter_level.gaps_notified", porterId, {
				porterId,
				targetLevel: overview.nextLevel,
				missingCount: missing.length,
				message: summaryText,
			});
		});

		await this.notifications.dispatch().catch(() => undefined);
		return { sent: true, missingCount: missing.length, message: summaryText };
	}
}
