import { ApiProperty } from "@nestjs/swagger";

export class SettlementStatusResponseDto {
	@ApiProperty({ description: "Trip ID" })
	tripId!: string;

	@ApiProperty({ description: "Whether settlement/payout is currently blocked" })
	isBlocked!: boolean;

	@ApiProperty({ description: "Reasons for blocking settlement", type: [String] })
	blockingReasons!: string[];

	@ApiProperty({ description: "Pending refund payment IDs blocking settlement", type: [String] })
	blockingPaymentIds!: string[];

	@ApiProperty({ description: "Total succeeded charges for the Trip" })
	totalCharges!: string;

	@ApiProperty({ description: "Total succeeded refunds for the Trip" })
	totalSucceededRefunds!: string;

	@ApiProperty({ description: "Current Held Funds" })
	heldFunds!: string;

	@ApiProperty({ description: "Eligible settlement base" })
	settlementBase!: string;
}
