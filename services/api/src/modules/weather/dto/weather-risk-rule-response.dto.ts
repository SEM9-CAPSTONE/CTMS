import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WeatherRiskRuleResponseDto {
	@ApiProperty({ description: "Unique UUID identifier of the weather risk rule version" })
	id!: string;

	@ApiProperty({ description: "Auto-incrementing rule version number" })
	version!: number;

	@ApiProperty({ description: "Rainfall yellow threshold (mm)" })
	rainfallYellowThreshold!: number;

	@ApiProperty({ description: "Rainfall red threshold (mm)" })
	rainfallRedThreshold!: number;

	@ApiProperty({ description: "Wind yellow threshold (km/h)" })
	windYellowThreshold!: number;

	@ApiProperty({ description: "Wind red threshold (km/h)" })
	windRedThreshold!: number;

	@ApiProperty({ description: "Temperature low yellow threshold (°C)" })
	tempLowYellow!: number;

	@ApiProperty({ description: "Temperature low red threshold (°C)" })
	tempLowRed!: number;

	@ApiProperty({ description: "Temperature high yellow threshold (°C)" })
	tempHighYellow!: number;

	@ApiProperty({ description: "Temperature high red threshold (°C)" })
	tempHighRed!: number;

	@ApiProperty({ description: "Visibility yellow threshold (m)" })
	visibilityYellowThreshold!: number;

	@ApiProperty({ description: "Visibility red threshold (m)" })
	visibilityRedThreshold!: number;

	@ApiProperty({ description: "Thunderstorm yellow flag" })
	thunderstormYellow!: boolean;

	@ApiProperty({ description: "Thunderstorm red flag" })
	thunderstormRed!: boolean;

	@ApiProperty({ description: "Rainfall criteria weight (0.0 to 1.0)" })
	rainfallWeight!: number;

	@ApiProperty({ description: "Wind criteria weight (0.0 to 1.0)" })
	windWeight!: number;

	@ApiProperty({ description: "Temperature criteria weight (0.0 to 1.0)" })
	temperatureWeight!: number;

	@ApiProperty({ description: "Visibility criteria weight (0.0 to 1.0)" })
	visibilityWeight!: number;

	@ApiProperty({ description: "Thunderstorm criteria weight (0.0 to 1.0)" })
	thunderstormWeight!: number;

	@ApiProperty({ description: "Maximum composite score for GREEN risk level" })
	greenMaxScore!: number;

	@ApiProperty({ description: "Maximum composite score for YELLOW risk level" })
	yellowMaxScore!: number;

	@ApiProperty({ description: "Indicates if this is the currently active rule version" })
	isActive!: boolean;

	@ApiPropertyOptional({ description: "UUID of the user who created this rule version" })
	createdBy?: string | null;

	@ApiProperty({ description: "Creation timestamp" })
	createdAt!: Date;
}
