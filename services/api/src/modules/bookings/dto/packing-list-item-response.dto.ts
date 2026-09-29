import { ApiProperty } from "@nestjs/swagger";
import { PackingListItemCategory } from "../packing-list-item-category.enum";

export class PackingListItemResponseDto {
	@ApiProperty({ description: "Stable slug, deterministic across requests for the same inputs" })
	id!: string;

	@ApiProperty()
	name!: string;

	@ApiProperty({ enum: PackingListItemCategory })
	category!: PackingListItemCategory;

	@ApiProperty({ description: "false means recommended, not mandatory" })
	required!: boolean;

	@ApiProperty({ description: "Short explanation of why this item was included" })
	reason!: string;

	@ApiProperty({ description: "true when already satisfied by the Booking's own rented equipment" })
	alreadyCovered!: boolean;
}
