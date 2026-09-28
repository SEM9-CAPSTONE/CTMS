import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BookingPaymentStatus, BookingStatus } from "../../profiles/entities/booking.entity";
import { BookingItemType } from "../booking-item-type.enum";
import { BookingMemberStatus } from "../booking-member-status.enum";

export class BookingTripPresentationDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	currentTitle!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty()
	currentRouteName!: string;
}

export class BookingMemberDetailsDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiPropertyOptional({ format: "uuid", nullable: true })
	userId!: string | null;

	@ApiPropertyOptional({ type: String, nullable: true })
	email!: string | null;

	@ApiProperty()
	isPrimary!: boolean;

	@ApiProperty({ enum: BookingMemberStatus })
	memberStatus!: BookingMemberStatus;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiProperty({ type: String, format: "date-time" })
	updatedAt!: Date;
}

export class BookingEquipmentPresentationDto {
	@ApiProperty()
	currentName!: string;
}

export class BookingEquipmentItemDetailsDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ enum: BookingItemType })
	itemType!: BookingItemType;

	@ApiProperty({ format: "uuid" })
	equipmentCatalogItemId!: string;

	@ApiProperty({ minimum: 1 })
	quantity!: number;

	@ApiProperty({ type: String, example: "50000.00" })
	unitPrice!: string;

	@ApiProperty({ minimum: 1 })
	rentalDays!: number;

	@ApiProperty({ type: String, example: "200000.00" })
	totalPrice!: string;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiPropertyOptional({ type: BookingEquipmentPresentationDto, nullable: true })
	presentation!: BookingEquipmentPresentationDto | null;
}

export class BookingDetailsResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	userId!: string;

	@ApiPropertyOptional({ minimum: 1, nullable: true })
	numPeople!: number | null;

	@ApiPropertyOptional({ enum: BookingStatus, nullable: true })
	status!: BookingStatus | null;

	@ApiPropertyOptional({ enum: BookingPaymentStatus, nullable: true })
	paymentStatus!: BookingPaymentStatus | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	holdExpiresAt!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	tripStartsAtSnapshot!: Date | null;

	@ApiPropertyOptional({ type: String, format: "date-time", nullable: true })
	tripEndsAtSnapshot!: Date | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "1500000.00" })
	basePrice!: string | null;

	@ApiPropertyOptional({ type: String, nullable: true, example: "1700000.00" })
	totalAmount!: string | null;

	@ApiPropertyOptional({ type: Object, nullable: true })
	cancellationPolicySnapshot!: Record<string, unknown> | null;

	@ApiProperty({ type: String, format: "date-time" })
	createdAt!: Date;

	@ApiPropertyOptional({ type: BookingTripPresentationDto, nullable: true })
	tripPresentation!: BookingTripPresentationDto | null;

	@ApiProperty({ type: BookingMemberDetailsDto, isArray: true })
	members!: BookingMemberDetailsDto[];

	@ApiProperty({ type: BookingEquipmentItemDetailsDto, isArray: true })
	equipmentItems!: BookingEquipmentItemDetailsDto[];
}
