import { ArrayMaxSize, ArrayUnique, IsArray, IsISO8601, IsUUID } from "class-validator";
import { CreateTripDto } from "./create-trip.dto";
export class FinalizeTripUpdateDto extends CreateTripDto {
	@IsISO8601({ strict: true }) expectedUpdatedAt!: string;
	@IsArray()
	@ArrayMaxSize(5)
	@ArrayUnique()
	@IsUUID("all", { each: true })
	retainedImageIds!: string[];
}
