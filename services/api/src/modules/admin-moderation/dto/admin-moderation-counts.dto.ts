import { ApiProperty } from "@nestjs/swagger";

export class AdminModerationCountsDto {
	@ApiProperty({ minimum: 0 })
	trips!: number;

	@ApiProperty({ minimum: 0 })
	trekkingRoutes!: number;

	@ApiProperty({ minimum: 0 })
	porterVerifications!: number;

	@ApiProperty({ minimum: 0 })
	contentReports!: number;
}
