import { ApiProperty } from "@nestjs/swagger";

export class ReportTimeWindowDto {
	@ApiProperty({ example: "2026-10-01T00:00:00.000Z" })
	from!: string;

	@ApiProperty({ example: "2026-10-31T23:59:59.999Z" })
	to!: string;

	@ApiProperty({ example: "30d", required: false })
	preset?: string;
}

export class BookingMetricsDto {
	@ApiProperty({ description: "Total bookings recorded within time window", example: 48 })
	total!: number;

	@ApiProperty({ description: "Confirmed bookings", example: 25 })
	confirmed!: number;

	@ApiProperty({ description: "Completed bookings", example: 15 })
	completed!: number;

	@ApiProperty({ description: "Cancelled bookings", example: 5 })
	cancelled!: number;

	@ApiProperty({ description: "Pending payment bookings", example: 3 })
	pending!: number;
}

export class TripMetricsDto {
	@ApiProperty({ description: "Total trips recorded within time window", example: 12 })
	total!: number;

	@ApiProperty({ description: "Completed trips", example: 8 })
	completed!: number;

	@ApiProperty({ description: "Ongoing trips", example: 1 })
	ongoing!: number;

	@ApiProperty({ description: "Published / open trips", example: 2 })
	published!: number;

	@ApiProperty({ description: "Cancelled trips", example: 1 })
	cancelled!: number;
}

export class RevenueMetricItemDto {
	@ApiProperty({ description: "Revenue amount in VND", example: 125000000 })
	amount!: number;

	@ApiProperty({
		description: "Classification label (BR-283, PB AC-7/PB AC-8)",
		example: "Estimated",
	})
	label!: "Estimated" | "Actual";

	@ApiProperty({ description: "Whether this metric is an estimate", example: true })
	isEstimated!: boolean;

	@ApiProperty({
		description: "Authoritative financial ledger source",
		example: "settlements",
		required: false,
	})
	ledgerSource?: string;
}

export class RevenueBreakdownDto {
	@ApiProperty({
		type: () => RevenueMetricItemDto,
		description: "Estimated revenue from active/unsettled bookings",
	})
	estimated!: RevenueMetricItemDto;

	@ApiProperty({
		type: () => RevenueMetricItemDto,
		description: "Authoritative actual revenue from settlements ledger",
	})
	actual!: RevenueMetricItemDto;

	@ApiProperty({
		description: "Platform 5% fee actually collected from settled trips",
		example: 4750000,
		required: false,
	})
	platformFeeActual?: number;

	@ApiProperty({
		description: "Platform 5% fee estimated from unsettled active bookings",
		example: 4662500,
		required: false,
	})
	platformFeeEstimated?: number;

	@ApiProperty({
		description: "Total gross merchandise value settled",
		example: 95000000,
		required: false,
	})
	gmvActual?: number;

	@ApiProperty({
		description: "Total gross merchandise value in escrow / unsettled",
		example: 93250000,
		required: false,
	})
	gmvEstimated?: number;
}

export class PerformanceTrendPointDto {
	@ApiProperty({ example: "2026-10-15" })
	date!: string;

	@ApiProperty({ example: 4 })
	bookingCount!: number;

	@ApiProperty({ example: 1 })
	tripCount!: number;

	@ApiProperty({ example: 80.5 })
	fillRate!: number;

	@ApiProperty({ example: 5.2 })
	cancellationRate!: number;

	@ApiProperty({ example: 4500000 })
	estimatedRevenue!: number;

	@ApiProperty({ example: 3800000 })
	actualRevenue!: number;
}

export class PerformanceTripBreakdownDto {
	@ApiProperty({ example: "b0000000-0000-0000-0000-000000000001" })
	id!: string;

	@ApiProperty({ example: "Trekking Tà Năng - Phan Dũng 3N2Đ" })
	title!: string;

	@ApiProperty({ example: "Tà Năng - Phan Dũng", required: false })
	routeName?: string;

	@ApiProperty({ example: "published" })
	status!: string;

	@ApiProperty({ example: 12 })
	bookingCount!: number;

	@ApiProperty({ example: 18 })
	seatsTaken!: number;

	@ApiProperty({ example: 20 })
	capacity!: number;

	@ApiProperty({ example: 90.0 })
	fillRate!: number;

	@ApiProperty({ example: 8.3 })
	cancellationRate!: number;

	@ApiProperty({ example: 25000000 })
	estimatedRevenue!: number;

	@ApiProperty({ example: 22500000 })
	actualRevenue!: number;
}

export class PerformanceReportResponseDto {
	@ApiProperty({ type: () => ReportTimeWindowDto })
	timeWindow!: ReportTimeWindowDto;

	@ApiProperty({ example: { role: "admin" } })
	scope!: {
		role: string;
		hostId?: string;
	};

	@ApiProperty({ type: () => BookingMetricsDto })
	bookings!: BookingMetricsDto;

	@ApiProperty({ type: () => TripMetricsDto })
	trips!: TripMetricsDto;

	@ApiProperty({
		description: "Overall trip capacity fill rate percentage (0 - 100)",
		example: 78.5,
	})
	fillRate!: number;

	@ApiProperty({
		description: "Overall booking cancellation rate percentage (0 - 100)",
		example: 10.4,
	})
	cancellationRate!: number;

	@ApiProperty({ type: () => RevenueBreakdownDto })
	revenue!: RevenueBreakdownDto;

	@ApiProperty({ type: () => [PerformanceTrendPointDto] })
	timeSeries!: PerformanceTrendPointDto[];

	@ApiProperty({ type: () => [PerformanceTripBreakdownDto] })
	breakdown!: PerformanceTripBreakdownDto[];
}
