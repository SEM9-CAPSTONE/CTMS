import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";
import { TripStatus } from "../../trips/entities/trip.entity";
import { BookingMemberStatus } from "../booking-member-status.enum";

export class TripBookingBookerDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiPropertyOptional({ nullable: true })
	fullName!: string | null;

	@ApiPropertyOptional({ nullable: true })
	email!: string | null;

	@ApiPropertyOptional({ nullable: true })
	phone!: string | null;

	@ApiPropertyOptional({ nullable: true })
	avatarUrl?: string | null;
}

export class TripBookingEquipmentItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	equipmentCatalogItemId!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	category!: string;

	@ApiProperty()
	quantity!: number;

	@ApiProperty()
	unitPrice!: string;

	@ApiProperty()
	rentalDays!: number;

	@ApiProperty()
	totalPrice!: string;
}

export class TripBookingMemberDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiPropertyOptional({ nullable: true })
	displayName!: string | null;

	@ApiPropertyOptional({ nullable: true })
	email!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;
}

export class TripBookingItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	userId!: string;

	@ApiProperty()
	numPeople!: number;

	@ApiProperty({ enum: BookingStatus })
	status!: BookingStatus;

	@ApiProperty({ enum: BookingPaymentStatus })
	paymentStatus!: BookingPaymentStatus;

	@ApiPropertyOptional({ nullable: true })
	basePrice!: string | null;

	@ApiPropertyOptional({ nullable: true })
	totalAmount!: string | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	completedAt!: Date | null;

	@ApiProperty({ type: TripBookingBookerDto })
	booker!: TripBookingBookerDto;

	@ApiProperty({ type: TripBookingMemberDto, isArray: true })
	members!: TripBookingMemberDto[];

	@ApiProperty({ type: TripBookingEquipmentItemDto, isArray: true })
	equipmentItems!: TripBookingEquipmentItemDto[];
}

export class TripEquipmentPreparationItemDto {
	@ApiProperty({ format: "uuid" })
	equipmentCatalogItemId!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty()
	category!: string;

	@ApiProperty()
	inventoryQuantity!: number;

	@ApiProperty()
	totalQuantity!: number;

	@ApiProperty()
	bookingCount!: number;
}

export class TripBookingsResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ enum: TripStatus })
	status!: TripStatus;

	@ApiProperty({ type: String, format: "date-time" })
	startsAt!: Date;

	@ApiProperty({ type: TripBookingItemDto, isArray: true })
	bookings!: TripBookingItemDto[];

	@ApiProperty({ type: TripEquipmentPreparationItemDto, isArray: true })
	equipmentSummary!: TripEquipmentPreparationItemDto[];
}
