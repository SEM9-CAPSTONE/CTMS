import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PorterRequestStatus } from "../entities/porter-request.entity";
import { IntendedPorterRole } from "./available-porters-query.dto";

export class PorterRequestResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ format: "uuid" })
	requestedBy!: string;

	@ApiProperty({ enum: IntendedPorterRole })
	requestedRole!: IntendedPorterRole;

	@ApiPropertyOptional({ nullable: true })
	note!: string | null;

	@ApiProperty({ enum: PorterRequestStatus })
	status!: PorterRequestStatus;

	@ApiProperty()
	expiresAt!: Date;

	@ApiPropertyOptional({ nullable: true })
	respondedAt!: Date | null;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}
