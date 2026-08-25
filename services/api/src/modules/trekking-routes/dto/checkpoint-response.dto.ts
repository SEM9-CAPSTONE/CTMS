import { ApiProperty } from "@nestjs/swagger";
import { CheckpointType } from "../entities/checkpoint.entity";
import { GeoJsonPointDto } from "./create-checkpoint.dto";

export class CheckpointResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	routeId!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ type: GeoJsonPointDto })
	location!: GeoJsonPointDto;

	@ApiProperty()
	radiusMeters!: number;

	@ApiProperty({ enum: CheckpointType })
	type!: CheckpointType;

	@ApiProperty()
	expectedArrivalOffset!: number;

	@ApiProperty()
	instructions!: string;

	@ApiProperty()
	nearbyWaterOrShelter!: boolean;

	@ApiProperty({ minimum: 0, maximum: 1 })
	routePosition!: number;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}
