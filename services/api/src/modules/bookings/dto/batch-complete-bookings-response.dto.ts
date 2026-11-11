import { ApiProperty } from "@nestjs/swagger";

export class BatchCompleteBookingsResponseDto {
	@ApiProperty({ format: "uuid" })
	tripId!: string;

	@ApiProperty({ example: 3 })
	completedCount!: number;

	@ApiProperty({ isArray: true, type: String })
	completedBookingIds!: string[];

	@ApiProperty({ example: 0 })
	skippedCount!: number;
}
