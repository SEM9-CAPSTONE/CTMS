import { ApiProperty } from "@nestjs/swagger";

export class WeatherAdviceResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	assessmentId!: string;

	@ApiProperty({ type: String })
	adviceText!: string;

	@ApiProperty({ type: [String] })
	actions!: string[];

	@ApiProperty({ format: "uuid" })
	createdBy!: string;

	@ApiProperty({ format: "date-time" })
	createdAt!: Date;
}
