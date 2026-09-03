import { ApiProperty } from "@nestjs/swagger";
import { RiskLevel } from "../entities/weather-risk-assessment.entity";

export class RegistrationBlockedReasonDto {
	@ApiProperty({
		description:
			"Criterion identifier (e.g. rainfall, wind, temperature, visibility, thunderstorm)",
		example: "rainfall",
	})
	criterion!: string;

	@ApiProperty({ enum: RiskLevel, description: "Risk level for this criterion", example: "red" })
	level!: RiskLevel;

	@ApiProperty({ description: "Recorded value for this criterion", example: 65 })
	value!: number | boolean;

	@ApiProperty({
		description: "Human-readable explanation of why criterion triggered risk",
		example: "Rainfall (65mm) exceeds Red threshold",
	})
	message!: string;
}

export class RegistrationEligibilityResponseDto {
	@ApiProperty({
		description: "Whether new registrations/bookings are allowed for this route/trip",
		example: false,
	})
	allowed!: boolean;

	@ApiProperty({
		description: "Trekking Route ID",
		example: "11111111-1111-1111-1111-111111111111",
	})
	routeId!: string;

	@ApiProperty({
		enum: RiskLevel,
		description: "Composite risk level of the route",
		example: "red",
	})
	riskLevel!: RiskLevel;

	@ApiProperty({
		description: "Assessment timestamp (BR-073)",
		example: "2026-09-03T12:00:00.000Z",
	})
	assessmentTime!: Date;

	@ApiProperty({ description: "Composite risk score", example: 1.4 })
	compositeScore!: number;

	@ApiProperty({
		type: [RegistrationBlockedReasonDto],
		description: "Detailed breakdown of failing risk criteria (BR-071, BR-073)",
	})
	reasons!: RegistrationBlockedReasonDto[];
}
