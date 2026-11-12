import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsUUID, Matches } from "class-validator";

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
