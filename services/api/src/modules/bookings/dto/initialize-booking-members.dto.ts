import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsUUID, ValidateNested } from "class-validator";

export class InitializeBookingMemberInputDto {
	@ApiProperty({ format: "uuid", description: "Existing CTMS user to add as a participant" })
	@IsUUID()
	userId!: string;
}

export class InitializeBookingMembersDto {
	@ApiProperty({
		type: InitializeBookingMemberInputDto,
		isArray: true,
		description:
			"Additional participants. The authenticated Booking owner is inserted automatically as primary.",
	})
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => InitializeBookingMemberInputDto)
	members!: InitializeBookingMemberInputDto[];
}
