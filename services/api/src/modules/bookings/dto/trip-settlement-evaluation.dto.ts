import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class TripSettlementEvaluationDto {
	@ApiProperty({ description: "Trip ID" })
	tripId!: string;

	@ApiProperty({ description: "Trip Title" })
	tripTitle!: string;

	@ApiProperty({ description: "Host User ID" })
	hostId!: string;

	@ApiProperty({ description: "Host Name" })
	hostName!: string;

	@ApiProperty({ description: "Trip Status" })
	tripStatus!: string;

	@ApiPropertyOptional({ description: "Trip completion timestamp" })
	completedAt!: Date | null;

	@ApiPropertyOptional({ description: "Hours elapsed since trip completion" })
	hoursSinceCompleted!: number | null;

	@ApiProperty({ description: "Whether trip status is completed (PB AC-1)" })
	isCompleted!: boolean;

	@ApiProperty({ description: "Whether 72-hour hold period has elapsed (PB AC-2)" })
	isHoldPeriodSatisfied!: boolean;

	@ApiProperty({ description: "Whether 24-hour complaint window has ended (PB AC-3)" })
	isComplaintWindowSatisfied!: boolean;

	@ApiProperty({
		description: "Whether settlement is blocked by claims or pending refunds (PB AC-4)",
	})
	isBlocked!: boolean;

	@ApiProperty({ description: "List of blocking reasons if any", type: [String] })
	blockingReasons!: string[];

	@ApiProperty({ description: "Whether this trip is eligible to be settled right now" })
	isEligible!: boolean;

	@ApiProperty({ description: "Whether trip has already been settled" })
	isSettled!: boolean;

	@ApiPropertyOptional({ description: "Authoritative settlement timestamp if settled" })
	settledAt!: Date | null;

	@ApiProperty({ description: "Total succeeded camper charges (VND)" })
	totalCharges!: string;

	@ApiProperty({ description: "Total succeeded camper refunds (VND)" })
	totalSucceededRefunds!: string;

	@ApiProperty({ description: "Settlement base = Total charges - Succeeded refunds (VND)" })
	settlementBase!: string;

	@ApiProperty({ description: "Snapshotted Platform commission rate (5%)" })
	commissionRate!: string;

	@ApiProperty({ description: "Platform Fee = 5% of settlement base (VND)" })
	platformFee!: string;

	@ApiProperty({ description: "Host Net Amount = 95% of settlement base (VND)" })
	hostNetAmount!: string;
}

export class SettlementResponseDto {
	@ApiProperty({ description: "Settlement ID" })
	id!: string;

	@ApiProperty({ description: "Trip ID" })
	tripId!: string;

	@ApiProperty({ description: "Host ID" })
	hostId!: string;

	@ApiProperty({ description: "Settlement base (VND)" })
	settlementBase!: string;

	@ApiProperty({ description: "Commission rate applied" })
	commissionRate!: string;

	@ApiProperty({ description: "Platform fee retained (VND)" })
	platformFee!: string;

	@ApiProperty({ description: "Net amount credited to Host Wallet (VND)" })
	netAmount!: string;

	@ApiProperty({ description: "Settlement timestamp" })
	settledAt!: Date;

	@ApiProperty({ description: "Host wallet balance after settlement (VND)" })
	walletBalanceAfter!: string;
}
