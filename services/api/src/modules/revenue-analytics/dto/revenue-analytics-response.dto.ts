import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ReportTimeWindowDto } from "../../performance-reports/dto/performance-report-response.dto";
import { RevenueGranularity } from "./get-revenue-analytics-query.dto";

export const REVENUE_REPORTING_CURRENCY = "VND" as const;

export class RevenueScopeDto {
	@ApiProperty({ enum: ["admin", "host"] })
	role!: "admin" | "host";

	@ApiPropertyOptional({ format: "uuid" })
	hostId?: string;

	@ApiPropertyOptional({ example: "DNG-SON-TRA" })
	areaCode?: string;
}

/** BR-326. Fixed date basis of each KPI, disclosed with every report. */
export class RevenueDateBasisDto {
	@ApiProperty({ example: "payment_succeeded_at" })
	grossRevenue!: "payment_succeeded_at";

	@ApiProperty({ example: "refund_succeeded_at" })
	refundAmount!: "refund_succeeded_at";

	@ApiProperty({ example: "settled_at" })
	platformFee!: "settled_at";

	@ApiProperty({ example: "settled_at" })
	netRevenue!: "settled_at";

	@ApiProperty({ example: "adjustment_created_at" })
	postSettlementRefund!: "adjustment_created_at";

	@ApiProperty({ example: "payout_succeeded_at" })
	payout!: "payout_succeeded_at";

	@ApiProperty({ example: "current_balance" })
	heldFunds!: "current_balance";
}

export class RevenueKpisDto {
	@ApiProperty({ description: "Succeeded charges (BR-320)", example: 42000000 })
	grossRevenue!: number;

	@ApiProperty({ description: "Succeeded refunds only (BR-321)", example: 2000000 })
	refundAmount!: number;

	@ApiProperty({ description: "Settlement fee snapshot (BR-322)", example: 2000000 })
	platformFee!: number;

	@ApiProperty({
		description: "Settled Host entitlement minus refunds approved after settlement (BR-324)",
		example: 38000000,
	})
	netRevenue!: number;

	@ApiProperty({ description: "Refunds approved after settlement, deducted from net revenue" })
	postSettlementRefund!: number;

	@ApiProperty({
		nullable: true,
		type: Number,
		description: "Succeeded payouts. Null when an area filter is applied (payouts are per Host).",
	})
	payout!: number | null;

	@ApiProperty({ description: "Funds collected for Trips not yet settled (BR-325)" })
	heldFunds!: number;

	@ApiProperty({ nullable: true, type: Number, description: "Payout requests awaiting transfer" })
	pendingPayout!: number | null;

	@ApiProperty({ description: "Refunds requested but not yet transferred" })
	pendingRefundAmount!: number;

	@ApiProperty()
	pendingRefundCount!: number;
}

export class RevenueTimeSeriesPointDto {
	@ApiProperty({ example: "2026-10-01", description: "Bucket start date (Asia/Ho_Chi_Minh)" })
	bucket!: string;

	@ApiProperty() grossRevenue!: number;
	@ApiProperty() refundAmount!: number;
	@ApiProperty() platformFee!: number;
	@ApiProperty() netRevenue!: number;
	@ApiProperty({ nullable: true, type: Number }) payout!: number | null;
}

export class RevenueAreaBreakdownDto {
	@ApiProperty({ nullable: true, type: String, example: "DNG-SON-TRA" })
	areaCode!: string | null;

	@ApiProperty({ nullable: true, type: String, example: "Sơn Trà" })
	areaName!: string | null;

	@ApiProperty() tripCount!: number;
	@ApiProperty() grossRevenue!: number;
	@ApiProperty() refundAmount!: number;
	@ApiProperty() platformFee!: number;
	@ApiProperty() netRevenue!: number;
	@ApiProperty() heldFunds!: number;

	@ApiProperty({ description: "Share of gross revenue in percent", example: 42.5 })
	grossShare!: number;
}

export class RevenueTripBreakdownDto {
	@ApiProperty({ format: "uuid", description: "Link target only; not for display" })
	tripId!: string;

	@ApiProperty() title!: string;
	@ApiProperty() startsAt!: string;
	@ApiProperty({ nullable: true, type: String }) areaName!: string | null;
	@ApiProperty() bookingCount!: number;
	@ApiProperty() grossRevenue!: number;
	@ApiProperty() refundAmount!: number;
	@ApiProperty() platformFee!: number;
	@ApiProperty() netRevenue!: number;
	@ApiProperty() heldFunds!: number;
	@ApiProperty({ nullable: true, type: String }) settledAt!: string | null;
}

export class RevenueHostOptionDto {
	@ApiProperty({ format: "uuid" }) id!: string;
	@ApiProperty() fullName!: string;
}

export class RevenueAnalyticsResponseDto {
	@ApiProperty({ example: "VND", description: "Single reporting currency (BR-327)" })
	currency!: typeof REVENUE_REPORTING_CURRENCY;

	@ApiProperty({ type: ReportTimeWindowDto }) timeWindow!: ReportTimeWindowDto;
	@ApiProperty({ enum: RevenueGranularity }) granularity!: RevenueGranularity;
	@ApiProperty({ type: RevenueScopeDto }) scope!: RevenueScopeDto;
	@ApiProperty({ type: RevenueDateBasisDto }) dateBasis!: RevenueDateBasisDto;
	@ApiProperty({ type: RevenueKpisDto }) kpis!: RevenueKpisDto;

	@ApiProperty({ description: "False when payouts cannot be attributed to the selected area" })
	payoutAreaScoped!: boolean;

	@ApiProperty({ type: RevenueTimeSeriesPointDto, isArray: true })
	timeSeries!: RevenueTimeSeriesPointDto[];

	@ApiProperty({ type: RevenueAreaBreakdownDto, isArray: true })
	byArea!: RevenueAreaBreakdownDto[];

	@ApiProperty({ type: RevenueTripBreakdownDto, isArray: true })
	byTrip!: RevenueTripBreakdownDto[];

	@ApiPropertyOptional({ type: RevenueHostOptionDto, isArray: true, description: "Admin only" })
	hosts?: RevenueHostOptionDto[];
}
