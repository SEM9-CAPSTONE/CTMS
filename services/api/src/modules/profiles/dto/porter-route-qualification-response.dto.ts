import { ApiProperty } from "@nestjs/swagger";
import {
	PorterRouteProficiency,
	type PorterRouteQualification,
} from "../entities/porter-route-qualification.entity";
import type { RouteQualificationReviewRow } from "../repositories/porter-route-qualifications.repository";

export class PorterRouteQualificationResponseDto {
	@ApiProperty({ format: "uuid" })
	qualificationId!: string;

	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty({ enum: PorterRouteProficiency })
	proficiency!: PorterRouteProficiency;

	@ApiProperty({ minimum: 0 })
	timesLed!: number;

	@ApiProperty({ format: "uuid", nullable: true })
	verifiedBy!: string | null;

	@ApiProperty({ type: Date, nullable: true })
	verifiedAt!: Date | null;

	@ApiProperty({ minimum: 1 })
	version!: number;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

export class RoutePorterQualificationResponseDto extends PorterRouteQualificationResponseDto {
	@ApiProperty({ type: String, nullable: true })
	porterDisplayName!: string | null;
}

export function toPorterRouteQualificationResponse(
	qualification: PorterRouteQualification
): PorterRouteQualificationResponseDto {
	return {
		qualificationId: qualification.id,
		porterId: qualification.porterId,
		routeId: qualification.routeId,
		proficiency: qualification.proficiency,
		timesLed: qualification.timesLed,
		verifiedBy: qualification.verifiedBy,
		verifiedAt: qualification.verifiedAt,
		version: qualification.version,
		createdAt: qualification.createdAt,
		updatedAt: qualification.updatedAt,
	};
}

export function toRoutePorterQualificationResponse(
	row: RouteQualificationReviewRow
): RoutePorterQualificationResponseDto {
	return {
		qualificationId: row.qualificationId,
		porterId: row.porterId,
		porterDisplayName: row.porterDisplayName,
		routeId: row.routeId,
		proficiency: row.proficiency,
		timesLed: Number(row.timesLed),
		verifiedBy: row.verifiedBy,
		verifiedAt: row.verifiedAt,
		version: Number(row.version),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
