import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	Equals,
	IsIn,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	ValidateIf,
} from "class-validator";

export class PackageDeviceQueryDto {
	@ApiProperty({
		format: "uuid",
		description: "Installation identity; client supplied, not hardware attestation",
	})
	@IsUUID()
	deviceId!: string;
	@ApiProperty({ format: "uuid" }) @IsUUID() packageId!: string;
}
export class PackageDeviceReportDto extends PackageDeviceQueryDto {
	@ApiProperty({ enum: ["downloaded", "verified", "active"] })
	@IsIn(["downloaded", "verified", "active"])
	status!: "downloaded" | "verified" | "active";
	@ApiPropertyOptional({ description: "Client-computed SHA-256; required for verified/active" })
	@IsOptional()
	@Matches(/^[a-f0-9]{64}$/)
	sha256?: string;
}

export class CamperPreparationAcknowledgementDto {
	@ApiProperty({ format: "uuid", nullable: true })
	@ValidateIf((_, value) => value !== null)
	@IsUUID()
	packageId!: string | null;

	@ApiProperty()
	@IsString()
	@MaxLength(64)
	policyVersion!: string;

	@ApiProperty({ enum: [true] })
	@Equals(true)
	acknowledged!: true;
}
