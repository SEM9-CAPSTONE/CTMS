import { ConflictException, Injectable, NotFoundException, Optional } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { minorToMoney, moneyToMinor } from "../../bookings/cancellation-policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { EventsGateway } from "../../realtime/events.gateway";
import {
	type AdminPenaltyFilter,
	type HostWeatherPenaltyDto,
	type HostWeatherPenaltyListDto,
	type HostWeatherPenaltyRow,
	type RequestWeatherPenaltyWaiverDto,
	type ReviewWeatherPenaltyWaiverDto,
	outstandingMinor,
	toHostWeatherPenaltyDto,
} from "./host-weather-penalty.dto";
import { refundWaivedWeatherPenalty } from "./host-weather-penalty.ledger";
import {
	PENALTY_COUNT_WINDOW_MS,
	PENALTY_WAIVER_REVIEW_WORKING_DAYS,
	addWorkingDays,
	hostingBlockedUntil,
	hostingRestriction,
	paymentDueAt,
	penaltyAmountMinor,
	penaltyBaseMinor,
	penaltyTier,
	waiverRequestDeadline,
} from "./host-weather-penalty.policy";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { TripWeatherDecisionsRepository } from "./trip-weather-decisions.repository";

const PENALTY_COLUMNS = `penalty."id", penalty."trip_id", penalty."trip_title", penalty."trip_starts_at",
	penalty."host_id", host."full_name" AS "host_name", penalty."violation_number",
	penalty."booking_value"::text AS "booking_value", penalty."rate_basis_points",
	penalty."cap_amount"::text AS "cap_amount", penalty."amount"::text AS "amount",
	penalty."deducted_amount"::text AS "deducted_amount",
	penalty."collected_amount"::text AS "collected_amount", penalty."collected_at",
	penalty."collection_reference", penalty."collection_note", penalty."payment_due_at", penalty."status",
	penalty."hosting_blocked_until", penalty."waiver_deadline", penalty."waiver_reason",
	penalty."waiver_evidence_urls", penalty."waiver_requested_at", penalty."waiver_review_due_at",
	penalty."waiver_decision", penalty."waiver_reviewed_at", penalty."waiver_review_note",
	penalty."created_at"`;
const PENALTY_FROM = `FROM "host_weather_penalties" penalty
	LEFT JOIN "users" host ON host."id" = penalty."host_id"`;
const LIST_LIMIT = 200;
const UNPAID_CONDITION = `penalty."status" = 'applied'
	AND penalty."amount" > penalty."deducted_amount" + penalty."collected_amount"`;

export interface PenaltyTripContext {
	id: string;
	hostId: string;
	title: string;
	startsAt: Date;
}

/**
 * Weather penalty of policy §6/§7: created when an Admin had to decide because the Host gave no
 * on-time answer, listed for the Host and the Admins, and waived on a force-majeure request.
 */
@Injectable()
export class HostWeatherPenaltiesService {
	constructor(
		private readonly dataSource: DataSource,
		private readonly decisions: TripWeatherDecisionsRepository,
		@Optional() private readonly events?: EventsGateway
	) {}

	/**
	 * Penalty base of the Trip: the Host's earnings, i.e. the paid bookings minus the platform
	 * commission. Read before a cancel / reschedule changes the bookings, so a Trip cancelled with
	 * a full Camper refund still has its base fixed at the moment of the violation.
	 */
	async penaltyBaseValue(tripId: string): Promise<string> {
		const rows = (await this.dataSource.query(
			`SELECT COALESCE(SUM(booking."total_amount"), 0)::numeric(12,2)::text AS "value"
			 FROM "bookings" booking
			 WHERE booking."trip_id" = $1 AND booking."payment_status" = 'paid'
			   AND booking."status" IN ('confirmed', 'pending_reconfirmation', 'completed')`,
			[tripId]
		)) as Array<{ value: string }>;
		return minorToMoney(penaltyBaseMinor(moneyToMinor(rows[0]?.value ?? "0.00")));
	}

	/**
	 * Inserts the penalty for this (Trip, schedule) inside the Admin decision transaction. The
	 * Host's rows are serialised with an advisory lock so two Trips cannot share a violation number.
	 */
	async createInTransaction(
		manager: EntityManager,
		input: {
			trip: PenaltyTripContext;
			decisionId: string;
			/** Admin who decided; `null` when the system auto-cancelled the Trip. */
			adminId: string | null;
			/** From `penaltyBaseValue`: the Host's earnings of the Trip. */
			bookingValue: string;
			now: Date;
		}
	): Promise<HostWeatherPenaltyDto | null> {
		const { trip, now } = input;
		await manager.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
			`host-weather-penalty:${trip.hostId}`,
		]);
		const counted = (await manager.query(
			`SELECT COUNT(*)::int AS "count" FROM "host_weather_penalties"
			 WHERE "host_id" = $1 AND "status" = 'applied' AND "created_at" > $2`,
			[trip.hostId, new Date(now.getTime() - PENALTY_COUNT_WINDOW_MS)]
		)) as Array<{ count: number }>;
		const violationNumber = (counted[0]?.count ?? 0) + 1;
		const tier = penaltyTier(violationNumber);
		const amount = minorToMoney(penaltyAmountMinor(moneyToMinor(input.bookingValue), tier));
		const inserted = (await manager.query(
			`INSERT INTO "host_weather_penalties"
			   ("trip_id", "host_id", "trip_title", "trip_starts_at", "decision_id", "violation_number",
			    "booking_value", "rate_basis_points", "cap_amount", "amount", "hosting_blocked_until",
			    "waiver_deadline", "payment_due_at", "created_at", "updated_at")
			 VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9::numeric, $10::numeric, $11, $12, $14, $13, $13)
			 ON CONFLICT ("trip_id", "trip_starts_at") DO NOTHING
			 RETURNING "id"`,
			[
				trip.id,
				trip.hostId,
				trip.title.slice(0, 150),
				trip.startsAt,
				input.decisionId,
				violationNumber,
				input.bookingValue,
				tier.rateBasisPoints,
				`${tier.capVnd}.00`,
				amount,
				hostingBlockedUntil(tier, now),
				waiverRequestDeadline(trip.startsAt),
				now,
				paymentDueAt(now),
			]
		)) as Array<{ id: string }>;
		if (inserted.length === 0) return null;
		const penalty = await this.findById(inserted[0].id, manager);
		if (!penalty) return null;
		await this.audit(manager, input.adminId, "host.weather_penalty_created", penalty.id, {
			tripId: trip.id,
			hostId: trip.hostId,
			violationNumber,
			bookingValue: input.bookingValue,
			ratePercent: tier.rateBasisPoints / 100,
			amount,
			hostingBlockedUntil: penalty.hostingBlockedUntil,
			decisionId: input.decisionId,
		});
		return penalty;
	}

	/** Pushed after the decision transaction committed. */
	notifyCreated(penalty: HostWeatherPenaltyDto): void {
		this.events?.emitHostWeatherPenaltyCreated(penalty.hostId, {
			penaltyId: penalty.id,
			tripId: penalty.tripId,
			tripTitle: penalty.tripTitle,
			violationNumber: penalty.violationNumber,
			amount: penalty.amount,
			hostingBlockedUntil: penalty.hostingBlockedUntil,
			waiverDeadline: penalty.waiverDeadline,
		});
	}

	async listForHost(hostId: string, now = new Date()): Promise<HostWeatherPenaltyListDto> {
		const rows = (await this.dataSource.query(
			`SELECT ${PENALTY_COLUMNS} ${PENALTY_FROM}
			 WHERE penalty."host_id" = $1
			 ORDER BY penalty."created_at" DESC, penalty."id" DESC LIMIT ${LIST_LIMIT}`,
			[hostId]
		)) as HostWeatherPenaltyRow[];
		const items = rows.map((row) => toHostWeatherPenaltyDto(row, now));
		const outstanding = items.reduce((sum, item) => sum + moneyToMinor(item.outstandingAmount), 0n);
		const restriction = hostingRestriction(
			items
				.filter((item) => item.status === "applied")
				.map((item) => ({
					createdAt: new Date(item.createdAt),
					hostingBlockedUntil: item.hostingBlockedUntil ? new Date(item.hostingBlockedUntil) : null,
					outstandingMinor: moneyToMinor(item.outstandingAmount),
					paymentDueAt: new Date(item.payment.dueAt),
				})),
			now
		);
		return {
			items,
			outstandingTotal: minorToMoney(outstanding),
			overdueTotal: minorToMoney(restriction.overdueDebtMinor),
			hostingBlockedUntil: restriction.blockedUntil?.toISOString() ?? null,
			suspended: restriction.suspended,
		};
	}

	async listForAdmin(filter?: AdminPenaltyFilter): Promise<HostWeatherPenaltyDto[]> {
		const byStatus = filter === "applied" || filter === "waived";
		const where =
			filter === "waiver_pending"
				? `WHERE penalty."waiver_requested_at" IS NOT NULL AND penalty."waiver_decision" IS NULL`
				: filter === "unpaid"
					? `WHERE ${UNPAID_CONDITION}`
					: byStatus
						? `WHERE penalty."status" = $1`
						: "";
		// Unpaid penalties are worked through by payment deadline, the oldest debt first.
		const order =
			filter === "unpaid"
				? `penalty."payment_due_at" ASC, penalty."id" ASC`
				: `penalty."created_at" DESC, penalty."id" DESC`;
		const rows = (await this.dataSource.query(
			`SELECT ${PENALTY_COLUMNS} ${PENALTY_FROM} ${where} ORDER BY ${order} LIMIT ${LIST_LIMIT}`,
			byStatus ? [filter] : []
		)) as HostWeatherPenaltyRow[];
		return rows.map((row) => toHostWeatherPenaltyDto(row));
	}

	async getForAdmin(id: string): Promise<HostWeatherPenaltyDto> {
		const penalty = await this.findById(id);
		if (!penalty) throw new NotFoundException("Weather penalty not found");
		return penalty;
	}

	/** Host asks once, within 72 h after T-24h, with a reason and evidence files. */
	async requestWaiver(
		hostId: string,
		id: string,
		dto: RequestWeatherPenaltyWaiverDto,
		now = new Date()
	): Promise<HostWeatherPenaltyDto> {
		const penalty = await this.dataSource.transaction(async (manager) => {
			const locked = await this.lockRow(manager, id);
			if (!locked || locked.host_id !== hostId) {
				throw new NotFoundException("Weather penalty not found");
			}
			if (locked.waiver_requested_at) {
				throw new ConflictException("A waiver was already requested for this penalty");
			}
			if (now.getTime() > new Date(locked.waiver_deadline).getTime()) {
				throw new ConflictException("The waiver request window has closed");
			}
			await manager.query(
				`UPDATE "host_weather_penalties"
				 SET "waiver_reason" = $2, "waiver_evidence_urls" = $3::jsonb, "waiver_requested_at" = $4,
				     "waiver_review_due_at" = $5, "updated_at" = $4
				 WHERE "id" = $1`,
				[
					id,
					dto.reason,
					JSON.stringify(dto.evidenceUrls),
					now,
					addWorkingDays(now, PENALTY_WAIVER_REVIEW_WORKING_DAYS),
				]
			);
			await this.audit(
				manager,
				hostId,
				"host.weather_penalty_waiver_requested",
				id,
				{ evidenceUrls: dto.evidenceUrls },
				dto.reason
			);
			return this.findById(id, manager);
		});
		if (!penalty) throw new NotFoundException("Weather penalty not found");
		const adminIds = await this.decisions.findActiveAdminIds();
		this.events?.emitWeatherPenaltyWaiverRequested(adminIds, {
			penaltyId: penalty.id,
			tripId: penalty.tripId,
			tripTitle: penalty.tripTitle,
			hostId: penalty.hostId,
			hostName: penalty.hostName,
			reviewDueAt: penalty.waiver.reviewDueAt,
		});
		return penalty;
	}

	/**
	 * Locks the penalty and returns what the Host still owes on it, or `null` when the penalty is
	 * not the Host's. Used before opening a PayOS payment link for that amount.
	 */
	async lockOutstandingForHost(
		manager: EntityManager,
		hostId: string,
		id: string
	): Promise<string | null> {
		const locked = await this.lockRow(manager, id);
		if (!locked || locked.host_id !== hostId) return null;
		return minorToMoney(outstandingMinor(locked));
	}

	/**
	 * A PayOS payment of the Host succeeded: at most the amount still owed is recorded as collected,
	 * which lifts an overdue-debt block. Money paid beyond that (the penalty was waived or deducted
	 * while the link was open) is returned so the caller can flag it for an Admin to refund.
	 */
	async recordOnlinePayment(
		manager: EntityManager,
		input: { hostId: string; penaltyId: string; amount: string; reference: string; now: Date }
	): Promise<{ collectedAmount: string; excessAmount: string }> {
		const locked = await this.lockRow(manager, input.penaltyId);
		if (!locked) throw new NotFoundException("Weather penalty not found");
		const paid = moneyToMinor(input.amount);
		const owed = outstandingMinor(locked);
		const collected = owed > 0n ? (paid < owed ? paid : owed) : 0n;
		const collectedAmount = minorToMoney(collected);
		const excessAmount = minorToMoney(paid - collected);
		if (collected > 0n) {
			await manager.query(
				`UPDATE "host_weather_penalties"
				 SET "collected_amount" = "collected_amount" + $2::numeric, "collected_at" = $3,
				     "collected_by" = NULL, "collection_reference" = $4, "collection_note" = NULL,
				     "updated_at" = $3
				 WHERE "id" = $1`,
				[input.penaltyId, collectedAmount, input.now, input.reference]
			);
		}
		await this.audit(
			manager,
			input.hostId,
			"host.weather_penalty_paid_online",
			input.penaltyId,
			{ paidAmount: minorToMoney(paid), collectedAmount, excessAmount, reference: input.reference },
			collected < paid
				? "Host paid the weather penalty via PayOS; the excess must be refunded by an Admin"
				: "Host paid the weather penalty via PayOS"
		);
		return { collectedAmount, excessAmount };
	}

	/**
	 * Admin approves (penalty waived, not counted, money back, block lifted) or rejects (kept, with
	 * the reason). Camper refunds never depend on this (policy §6).
	 */
	async reviewWaiver(
		adminId: string,
		id: string,
		dto: ReviewWeatherPenaltyWaiverDto,
		now = new Date()
	): Promise<HostWeatherPenaltyDto> {
		const penalty = await this.dataSource.transaction(async (manager) => {
			const locked = await this.lockRow(manager, id);
			if (!locked) throw new NotFoundException("Weather penalty not found");
			if (!locked.waiver_requested_at) {
				throw new ConflictException("The Host has not requested a waiver");
			}
			if (locked.waiver_decision) {
				throw new ConflictException("This waiver request was already reviewed");
			}
			const decision = dto.approve ? "approved" : "rejected";
			let refundedAmount: string | null = null;
			if (dto.approve) {
				// What settlements deducted and what the Host paid by transfer both go back to the wallet.
				refundedAmount = minorToMoney(
					moneyToMinor(locked.deducted_amount) + moneyToMinor(locked.collected_amount)
				);
				await refundWaivedWeatherPenalty(manager, {
					hostId: locked.host_id,
					tripId: locked.trip_id,
					tripTitle: locked.trip_title,
					amount: refundedAmount,
				});
			}
			await manager.query(
				`UPDATE "host_weather_penalties"
				 SET "waiver_decision" = $2::varchar, "waiver_reviewed_by" = $3, "waiver_reviewed_at" = $4,
				     "waiver_review_note" = $5, "updated_at" = $4,
				     "status" = CASE WHEN $2::varchar = 'approved' THEN 'waived' ELSE "status" END,
				     "deducted_amount" = CASE WHEN $2::varchar = 'approved' THEN 0 ELSE "deducted_amount" END,
				     "collected_amount" = CASE WHEN $2::varchar = 'approved' THEN 0 ELSE "collected_amount" END,
				     "hosting_blocked_until" = CASE WHEN $2::varchar = 'approved' THEN NULL ELSE "hosting_blocked_until" END
				 WHERE "id" = $1`,
				[id, decision, adminId, now, dto.note]
			);
			await this.audit(
				manager,
				adminId,
				"host.weather_penalty_waiver_reviewed",
				id,
				{ decision, refundedAmount },
				dto.note
			);
			return this.findById(id, manager);
		});
		if (!penalty) throw new NotFoundException("Weather penalty not found");
		return penalty;
	}

	private async findById(
		id: string,
		manager?: EntityManager
	): Promise<HostWeatherPenaltyDto | null> {
		const rows = (await (manager ?? this.dataSource).query(
			`SELECT ${PENALTY_COLUMNS} ${PENALTY_FROM} WHERE penalty."id" = $1`,
			[id]
		)) as HostWeatherPenaltyRow[];
		return rows[0] ? toHostWeatherPenaltyDto(rows[0]) : null;
	}

	private async lockRow(
		manager: EntityManager,
		id: string
	): Promise<{
		host_id: string;
		trip_id: string;
		trip_title: string;
		status: "applied" | "waived";
		amount: string;
		deducted_amount: string;
		collected_amount: string;
		waiver_deadline: Date;
		waiver_requested_at: Date | null;
		waiver_decision: string | null;
	} | null> {
		const rows = await manager.query(
			`SELECT "host_id", "trip_id", "trip_title", "status", "amount"::text AS "amount",
			        "deducted_amount"::text AS "deducted_amount",
			        "collected_amount"::text AS "collected_amount",
			        "waiver_deadline", "waiver_requested_at", "waiver_decision"
			 FROM "host_weather_penalties" WHERE "id" = $1 FOR UPDATE`,
			[id]
		);
		return rows[0] ?? null;
	}

	private async audit(
		manager: EntityManager,
		actorId: string | null,
		action: string,
		penaltyId: string,
		after: Record<string, unknown>,
		reason = "Weather penalty (policy §6)"
	): Promise<void> {
		await manager.getRepository(AuditLog).save({
			actorId,
			action,
			targetType: "host_weather_penalty",
			targetId: penaltyId,
			before: null,
			after,
			// audit_logs.reason is varchar(255); long waiver texts stay whole on the penalty row.
			reason: reason.slice(0, 255),
		});
	}
}
