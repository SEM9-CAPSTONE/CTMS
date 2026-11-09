import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
	ArrayMaxSize,
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsNotEmpty,
	IsOptional,
	IsString,
	IsUrl,
	MaxLength,
} from "class-validator";
import { minorToMoney, moneyToMinor } from "../../bookings/cancellation-policy";

function trimmed(value: unknown): unknown {
	return typeof value === "string" ? value.trim() : value;
}

export const WEATHER_PENALTY_STATUSES = ["applied", "waived"] as const;
export type WeatherPenaltyStatus = (typeof WEATHER_PENALTY_STATUSES)[number];
export const ADMIN_PENALTY_FILTERS = ["applied", "waived", "waiver_pending"] as const;
export type AdminPenaltyFilter = (typeof ADMIN_PENALTY_FILTERS)[number];

export class RequestWeatherPenaltyWaiverDto {
	@ApiProperty({ maxLength: 1000, description: "Force majeure reason (illness, accident…)" })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	reason!: string;

	@ApiProperty({
		type: [String],
		minItems: 1,
		maxItems: 5,
		description: "Evidence files uploaded with POST /uploads/document",
	})
	@IsArray()
	@ArrayMinSize(1)
	@ArrayMaxSize(5)
	@IsUrl({ require_tld: false, protocols: ["http", "https"] }, { each: true })
	@MaxLength(500, { each: true })
	evidenceUrls!: string[];
}

export class ReviewWeatherPenaltyWaiverDto {
	@ApiProperty({ description: "true = waive the penalty, false = keep it" })
	@IsBoolean()
	approve!: boolean;

	@ApiProperty({ maxLength: 1000, description: "Mandatory review note / rejection reason" })
	@Transform(({ value }) => trimmed(value))
	@IsString()
	@IsNotEmpty()
	@MaxLength(1000)
	note!: string;
}

export class AdminWeatherPenaltyQueryDto {
	@ApiPropertyOptional({ enum: ADMIN_PENALTY_FILTERS })
	@IsOptional()
	@IsIn(ADMIN_PENALTY_FILTERS)
	status?: AdminPenaltyFilter;
}

export class WeatherPenaltyWaiverDto {
	@ApiPropertyOptional({ nullable: true })
	reason!: string | null;

	@ApiProperty({ type: [String] })
	evidenceUrls!: string[];

	@ApiPropertyOptional({ format: "date-time", nullable: true })
	requestedAt!: string | null;

	@ApiPropertyOptional({ format: "date-time", nullable: true, description: "5 working days" })
	reviewDueAt!: string | null;

	@ApiPropertyOptional({ enum: ["approved", "rejected"], nullable: true })
	decision!: "approved" | "rejected" | null;

	@ApiPropertyOptional({ format: "date-time", nullable: true })
	reviewedAt!: string | null;

	@ApiPropertyOptional({ nullable: true })
	reviewNote!: string | null;
}

export class HostWeatherPenaltyDto {
	@ApiProperty() id!: string;
	@ApiProperty() tripId!: string;
	@ApiProperty() tripTitle!: string;
	@ApiProperty({ format: "date-time" }) tripStartsAt!: string;
	@ApiProperty() hostId!: string;
	@ApiPropertyOptional({ nullable: true }) hostName!: string | null;
	@ApiProperty({ description: "Violation number in the last 90 days" }) violationNumber!: number;
	@ApiProperty({ example: "12000000.00" }) bookingValue!: string;
	@ApiProperty({ example: 5 }) ratePercent!: number;
	@ApiProperty({ example: "2000000.00" }) capAmount!: string;
	@ApiProperty({ example: "600000.00" }) amount!: string;
	@ApiProperty({ example: "0.00" }) deductedAmount!: string;
	@ApiProperty({ example: "600000.00", description: "Debt still to deduct" })
	outstandingAmount!: string;
	@ApiProperty({ enum: WEATHER_PENALTY_STATUSES }) status!: WeatherPenaltyStatus;
	@ApiPropertyOptional({ format: "date-time", nullable: true })
	hostingBlockedUntil!: string | null;
	@ApiProperty({ format: "date-time", description: "Last moment to ask for a waiver" })
	waiverDeadline!: string;
	@ApiProperty({ type: WeatherPenaltyWaiverDto }) waiver!: WeatherPenaltyWaiverDto;
	@ApiProperty({ format: "date-time" }) createdAt!: string;
}

export class HostWeatherPenaltyListDto {
	@ApiProperty({ type: [HostWeatherPenaltyDto] }) items!: HostWeatherPenaltyDto[];
	@ApiProperty({ example: "600000.00" }) outstandingTotal!: string;
	@ApiPropertyOptional({ format: "date-time", nullable: true })
	hostingBlockedUntil!: string | null;
	@ApiProperty() suspended!: boolean;
}

export interface HostWeatherPenaltyRow {
	id: string;
	trip_id: string;
	trip_title: string;
	trip_starts_at: Date | string;
	host_id: string;
	host_name: string | null;
	violation_number: number;
	booking_value: string;
	rate_basis_points: number;
	cap_amount: string;
	amount: string;
	deducted_amount: string;
	status: WeatherPenaltyStatus;
	hosting_blocked_until: Date | string | null;
	waiver_deadline: Date | string;
	waiver_reason: string | null;
	waiver_evidence_urls: string[] | null;
	waiver_requested_at: Date | string | null;
	waiver_review_due_at: Date | string | null;
	waiver_decision: "approved" | "rejected" | null;
	waiver_reviewed_at: Date | string | null;
	waiver_review_note: string | null;
	created_at: Date | string;
}

function iso(value: Date | string): string;
function iso(value: Date | string | null): string | null;
function iso(value: Date | string | null): string | null {
	return value === null ? null : new Date(value).toISOString();
}

function money(value: string): string {
	return minorToMoney(moneyToMinor(value));
}

export function toHostWeatherPenaltyDto(row: HostWeatherPenaltyRow): HostWeatherPenaltyDto {
	const outstanding =
		row.status === "applied" ? moneyToMinor(row.amount) - moneyToMinor(row.deducted_amount) : 0n;
	return {
		id: row.id,
		tripId: row.trip_id,
		tripTitle: row.trip_title,
		tripStartsAt: iso(row.trip_starts_at),
		hostId: row.host_id,
		hostName: row.host_name,
		violationNumber: row.violation_number,
		bookingValue: money(row.booking_value),
		ratePercent: row.rate_basis_points / 100,
		capAmount: money(row.cap_amount),
		amount: money(row.amount),
		deductedAmount: money(row.deducted_amount),
		outstandingAmount: minorToMoney(outstanding),
		status: row.status,
		hostingBlockedUntil: iso(row.hosting_blocked_until),
		waiverDeadline: iso(row.waiver_deadline),
		waiver: {
			reason: row.waiver_reason,
			evidenceUrls: row.waiver_evidence_urls ?? [],
			requestedAt: iso(row.waiver_requested_at),
			reviewDueAt: iso(row.waiver_review_due_at),
			decision: row.waiver_decision,
			reviewedAt: iso(row.waiver_reviewed_at),
			reviewNote: row.waiver_review_note,
		},
		createdAt: iso(row.created_at),
	};
}
