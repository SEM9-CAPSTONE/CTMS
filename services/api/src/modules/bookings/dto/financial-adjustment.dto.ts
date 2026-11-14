import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";
import {
	FinancialAdjustmentStatus,
	FinancialAdjustmentType,
} from "../entities/financial-adjustment.entity";
import { PaymentStatus } from "../entities/payment.entity";

export class AdjustmentQueryDto {
	@ApiPropertyOptional({
		description: "Filter by adjustment type: all | post_settlement_refund | post_payout_recovery",
		default: "all",
	})
	@IsOptional()
	@IsString()
	type?: string;

	@ApiPropertyOptional({
		description: "Filter by adjustment status: all | pending | resolved",
		default: "all",
	})
	@IsOptional()
	@IsString()
	status?: string;

	@ApiPropertyOptional({ description: "Filter by trip ID" })
	@IsOptional()
	@IsUUID("4")
	tripId?: string;

	@ApiPropertyOptional({ description: "Filter by booking ID" })
	@IsOptional()
	@IsUUID("4")
	bookingId?: string;

	@ApiPropertyOptional({ description: "Search term matching reason or notes" })
	@IsOptional()
	@IsString()
	search?: string;

	@ApiPropertyOptional({ description: "Page number", default: 1 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@ApiPropertyOptional({ description: "Items per page", default: 15 })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 15;
}

export class ResolveAdjustmentDto {
	@ApiPropertyOptional({
		description: "Optional notes when marking the adjustment as resolved",
		maxLength: 500,
	})
	@IsOptional()
	@IsString()
	@MaxLength(500, { message: "Ghi chú không được vượt quá 500 ký tự" })
	notes?: string;
}

export class ReconciliationBookingsQueryDto {
	@ApiPropertyOptional({ description: "Search by trip title, customer name or email" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	search?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	page = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	limit = 50;
}

export class FinancialAdjustmentResponseDto {
	@ApiPropertyOptional({ nullable: true })
	refundPaymentId?: string | null;

	@ApiPropertyOptional({ enum: PaymentStatus, nullable: true })
	refundStatus?: PaymentStatus | null;
	@ApiProperty({ description: "Adjustment UUID" })
	id!: string;

	@ApiPropertyOptional({ description: "Settlement UUID reference", nullable: true })
	settlementId!: string | null;

	@ApiPropertyOptional({ description: "Payout UUID reference", nullable: true })
	payoutId!: string | null;

	@ApiProperty({ description: "Booking UUID" })
	bookingId!: string;

	@ApiProperty({ description: "Booking customer name" })
	camperName!: string;

	@ApiPropertyOptional({ description: "Booking creation date", nullable: true })
	bookingCreatedAt!: Date | null;

	@ApiPropertyOptional({ description: "Original settlement date", nullable: true })
	settledAt!: Date | null;

	@ApiPropertyOptional({ description: "Original payout request date", nullable: true })
	payoutRequestedAt!: Date | null;

	@ApiProperty({ description: "Trip UUID" })
	tripId!: string;

	@ApiProperty({ description: "Trip title" })
	tripTitle!: string;

	@ApiProperty({ description: "Host UUID" })
	hostId!: string;

	@ApiProperty({ description: "Host full name" })
	hostName!: string;

	@ApiProperty({ enum: FinancialAdjustmentType, description: "Type of adjustment" })
	type!: FinancialAdjustmentType;

	@ApiProperty({ description: "Adjustment amount in VND" })
	amount!: string;

	@ApiProperty({ description: "Reason for adjustment" })
	reason!: string;

	@ApiProperty({ enum: FinancialAdjustmentStatus, description: "Resolution status" })
	status!: FinancialAdjustmentStatus;

	@ApiPropertyOptional({ description: "Admin actor UUID", nullable: true })
	actorId!: string | null;

	@ApiPropertyOptional({ description: "Admin notes", nullable: true })
	notes!: string | null;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;

	@ApiProperty({ description: "Last update timestamp" })
	updatedAt!: Date;
}
