import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import type { ResolvedTimeWindow } from "../performance-reports/report-time-window";
import { RevenueGranularity } from "./dto/get-revenue-analytics-query.dto";
import type { RevenueHostOptionDto } from "./dto/revenue-analytics-response.dto";

/** Reports bucket in the operating time zone so a booking at 23:30 lands on the right day. */
export const REPORT_TIME_ZONE = "Asia/Ho_Chi_Minh";

export interface RevenueScope {
	hostId?: string;
	areaCode?: string;
}

export interface PaymentBucketRow {
	tripId: string;
	type: "charge" | "refund";
	bucket: string;
	amount: string;
	bookingCount: number;
}

export interface SettlementRow {
	tripId: string;
	bucket: string;
	platformFee: string;
	netAmount: string;
	settledAt: Date;
}

export interface AmountBucketRow {
	tripId: string;
	bucket: string;
	amount: string;
}

export interface HeldFundsRow {
	tripId: string;
	amount: string;
}

export interface PendingRefundRow {
	count: number;
	amount: string | null;
}

export interface PayoutBucketRow {
	bucket: string;
	amount: string;
}

export interface TripMetaRow {
	id: string;
	title: string;
	startsAt: Date;
	areaCode: string | null;
	areaName: string | null;
	settledAt: Date | null;
}

const GRANULARITY_SQL: Record<RevenueGranularity, string> = {
	[RevenueGranularity.DAY]: "day",
	[RevenueGranularity.WEEK]: "week",
	[RevenueGranularity.MONTH]: "month",
};

/**
 * CTMS-110. Read-only aggregation over the financial ledger (BR-328). Every query filters Trips
 * by the caller's scope (BR-318) and the Trip area snapshot (BR-319), and each KPI reads its own
 * fixed date column (BR-326).
 */
@Injectable()
export class RevenueAnalyticsRepository {
	constructor(private readonly dataSource: DataSource) {}

	private tripScope(params: unknown[], scope: RevenueScope, alias = "t"): string {
		const conditions: string[] = [];
		if (scope.hostId) {
			params.push(scope.hostId);
			conditions.push(`${alias}."host_id" = $${params.length}`);
		}
		if (scope.areaCode) {
			params.push(scope.areaCode);
			conditions.push(`${alias}."area_code" = $${params.length}`);
		}
		return conditions.length ? conditions.join(" AND ") : "TRUE";
	}

	private bucketExpr(column: string, granularity: RevenueGranularity): string {
		const unit = GRANULARITY_SQL[granularity];
		return `to_char(date_trunc('${unit}', ${column} AT TIME ZONE '${REPORT_TIME_ZONE}'), 'YYYY-MM-DD')`;
	}

	async listBuckets(
		window: ResolvedTimeWindow,
		granularity: RevenueGranularity
	): Promise<string[]> {
		const unit = GRANULARITY_SQL[granularity];
		const rows = (await this.dataSource.query(
			`SELECT to_char(gs, 'YYYY-MM-DD') AS "bucket"
			 FROM generate_series(
				date_trunc('${unit}', $1::timestamptz AT TIME ZONE '${REPORT_TIME_ZONE}'),
				date_trunc('${unit}', $2::timestamptz AT TIME ZONE '${REPORT_TIME_ZONE}'),
				interval '1 ${unit}'
			 ) AS gs`,
			[window.from.toISOString(), window.to.toISOString()]
		)) as Array<{ bucket: string }>;
		return rows.map((row) => row.bucket);
	}

	/** BR-320 / BR-321. Only `succeeded` charges and refunds, dated by `succeeded_at`. */
	async sumSucceededPayments(
		window: ResolvedTimeWindow,
		scope: RevenueScope,
		granularity: RevenueGranularity
	): Promise<PaymentBucketRow[]> {
		const params: unknown[] = [window.from.toISOString(), window.to.toISOString()];
		const where = this.tripScope(params, scope);
		return this.dataSource.query(
			`SELECT
				t."id" AS "tripId",
				p."type"::text AS "type",
				${this.bucketExpr('p."succeeded_at"', granularity)} AS "bucket",
				SUM(p."amount")::text AS "amount",
				COUNT(DISTINCT p."booking_id")::int AS "bookingCount"
			 FROM "payments" p
			 JOIN "bookings" b ON b."id" = p."booking_id"
			 JOIN "trips" t ON t."id" = b."trip_id"
			 WHERE p."status" = 'succeeded'
				AND p."succeeded_at" >= $1 AND p."succeeded_at" <= $2
				AND ${where}
			 GROUP BY 1, 2, 3`,
			params
		);
	}

	/** BR-322 / BR-324. Fee and net come from the settlement snapshot, dated by `settled_at`. */
	async listSettlements(
		window: ResolvedTimeWindow,
		scope: RevenueScope,
		granularity: RevenueGranularity
	): Promise<SettlementRow[]> {
		const params: unknown[] = [window.from.toISOString(), window.to.toISOString()];
		const where = this.tripScope(params, scope);
		return this.dataSource.query(
			`SELECT
				s."trip_id" AS "tripId",
				${this.bucketExpr('s."settled_at"', granularity)} AS "bucket",
				s."platform_fee"::text AS "platformFee",
				s."net_amount"::text AS "netAmount",
				s."settled_at" AS "settledAt"
			 FROM "settlements" s
			 JOIN "trips" t ON t."id" = s."trip_id"
			 WHERE s."settled_at" >= $1 AND s."settled_at" <= $2 AND ${where}`,
			params
		);
	}

	/** Refunds approved after settlement reduce the Host entitlement on the day they were recorded. */
	async sumPostSettlementRefunds(
		window: ResolvedTimeWindow,
		scope: RevenueScope,
		granularity: RevenueGranularity
	): Promise<AmountBucketRow[]> {
		const params: unknown[] = [window.from.toISOString(), window.to.toISOString()];
		const where = this.tripScope(params, scope);
		return this.dataSource.query(
			`SELECT
				fa."trip_id" AS "tripId",
				${this.bucketExpr('fa."created_at"', granularity)} AS "bucket",
				SUM(fa."amount")::text AS "amount"
			 FROM "financial_adjustments" fa
			 JOIN "trips" t ON t."id" = fa."trip_id"
			 WHERE fa."type" IN ('post_settlement_refund', 'post_payout_recovery')
				AND fa."created_at" >= $1 AND fa."created_at" <= $2
				AND ${where}
			 GROUP BY 1, 2`,
			params
		);
	}

	/** BR-325. Money collected for Trips without a settlement yet. Current balance, not windowed. */
	async listHeldFunds(scope: RevenueScope): Promise<HeldFundsRow[]> {
		const params: unknown[] = [];
		const where = this.tripScope(params, scope);
		return this.dataSource.query(
			`SELECT t."id" AS "tripId",
				SUM(CASE WHEN p."type" = 'charge' THEN p."amount" ELSE -p."amount" END)::text AS "amount"
			 FROM "trips" t
			 JOIN "bookings" b ON b."trip_id" = t."id"
			 JOIN "payments" p ON p."booking_id" = b."id" AND p."status" = 'succeeded'
			 WHERE NOT EXISTS (SELECT 1 FROM "settlements" s WHERE s."trip_id" = t."id")
				AND ${where}
			 GROUP BY t."id"
			 HAVING SUM(CASE WHEN p."type" = 'charge' THEN p."amount" ELSE -p."amount" END) > 0`,
			params
		);
	}

	/** BR-321. Pending refunds stay a separate state; they are never part of the refund amount. */
	async sumPendingRefunds(scope: RevenueScope): Promise<PendingRefundRow> {
		const params: unknown[] = [];
		const where = this.tripScope(params, scope);
		const rows = (await this.dataSource.query(
			`SELECT COUNT(*)::int AS "count", SUM(p."amount")::text AS "amount"
			 FROM "payments" p
			 JOIN "bookings" b ON b."id" = p."booking_id"
			 JOIN "trips" t ON t."id" = b."trip_id"
			 WHERE p."type" = 'refund' AND p."status" = 'pending'
				AND COALESCE(p."review_status", 'pending_review') <> 'rejected'
				AND ${where}`,
			params
		)) as PendingRefundRow[];
		return rows[0] ?? { count: 0, amount: null };
	}

	/** BR-324. Cash actually transferred to the Host, dated by `succeeded_at`. Host-level only. */
	async sumSucceededPayouts(
		window: ResolvedTimeWindow,
		hostId: string | undefined,
		granularity: RevenueGranularity
	): Promise<PayoutBucketRow[]> {
		const params: unknown[] = [window.from.toISOString(), window.to.toISOString()];
		let hostCondition = "TRUE";
		if (hostId) {
			params.push(hostId);
			hostCondition = `po."host_id" = $${params.length}`;
		}
		return this.dataSource.query(
			`SELECT ${this.bucketExpr('po."succeeded_at"', granularity)} AS "bucket",
				SUM(po."amount")::text AS "amount"
			 FROM "payouts" po
			 WHERE po."status" = 'succeeded'
				AND po."succeeded_at" >= $1 AND po."succeeded_at" <= $2
				AND ${hostCondition}
			 GROUP BY 1`,
			params
		);
	}

	async sumPendingPayouts(hostId: string | undefined): Promise<string | null> {
		const params: unknown[] = [];
		let hostCondition = "TRUE";
		if (hostId) {
			params.push(hostId);
			hostCondition = `"host_id" = $1`;
		}
		const rows = (await this.dataSource.query(
			`SELECT SUM("amount")::text AS "amount" FROM "payouts"
			 WHERE "status" = 'pending' AND ${hostCondition}`,
			params
		)) as Array<{ amount: string | null }>;
		return rows[0]?.amount ?? null;
	}

	async findTrips(tripIds: string[]): Promise<TripMetaRow[]> {
		if (tripIds.length === 0) return [];
		return this.dataSource.query(
			`SELECT t."id", t."title", t."starts_at" AS "startsAt",
				t."area_code" AS "areaCode", t."area_name" AS "areaName",
				s."settled_at" AS "settledAt"
			 FROM "trips" t
			 LEFT JOIN "settlements" s ON s."trip_id" = t."id"
			 WHERE t."id" = ANY($1::uuid[])`,
			[tripIds]
		);
	}

	/** Admin filter options: Hosts that own at least one Trip. */
	async listHosts(): Promise<RevenueHostOptionDto[]> {
		return this.dataSource.query(
			`SELECT u."id", u."full_name" AS "fullName"
			 FROM "users" u
			 WHERE EXISTS (SELECT 1 FROM "trips" t WHERE t."host_id" = u."id")
			 ORDER BY u."full_name" ASC`
		);
	}
}
