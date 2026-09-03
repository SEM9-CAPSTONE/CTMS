import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, Max, Min } from "class-validator";

export class CreateWeatherRiskRuleDto {
	@ApiProperty({ example: 10.0, description: "Rainfall yellow threshold in mm" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	rainfallYellowThreshold!: number;

	@ApiProperty({ example: 50.0, description: "Rainfall red threshold in mm" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	rainfallRedThreshold!: number;

	@ApiProperty({ example: 40.0, description: "Wind yellow threshold in km/h" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	windYellowThreshold!: number;

	@ApiProperty({ example: 70.0, description: "Wind red threshold in km/h" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	windRedThreshold!: number;

	@ApiProperty({ example: 5.0, description: "Temperature low yellow threshold in °C" })
	@IsNumber()
	@IsNotEmpty()
	tempLowYellow!: number;

	@ApiProperty({ example: 0.0, description: "Temperature low red threshold in °C" })
	@IsNumber()
	@IsNotEmpty()
	tempLowRed!: number;

	@ApiProperty({ example: 38.0, description: "Temperature high yellow threshold in °C" })
	@IsNumber()
	@IsNotEmpty()
	tempHighYellow!: number;

	@ApiProperty({ example: 42.0, description: "Temperature high red threshold in °C" })
	@IsNumber()
	@IsNotEmpty()
	tempHighRed!: number;

	@ApiProperty({ example: 5000.0, description: "Visibility yellow threshold in meters" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	visibilityYellowThreshold!: number;

	@ApiProperty({ example: 1000.0, description: "Visibility red threshold in meters" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	visibilityRedThreshold!: number;

	@ApiProperty({ example: true, description: "Thunderstorm activity triggers yellow score" })
	@IsBoolean()
	@IsNotEmpty()
	thunderstormYellow!: boolean;

	@ApiProperty({ example: true, description: "Thunderstorm activity triggers red score" })
	@IsBoolean()
	@IsNotEmpty()
	thunderstormRed!: boolean;

	@ApiProperty({ example: 0.3, description: "Rainfall weight (0.0 to 1.0)" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Max(1)
	rainfallWeight!: number;

	@ApiProperty({ example: 0.25, description: "Wind weight (0.0 to 1.0)" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Max(1)
	windWeight!: number;

	@ApiProperty({ example: 0.15, description: "Temperature weight (0.0 to 1.0)" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Max(1)
	temperatureWeight!: number;

	@ApiProperty({ example: 0.15, description: "Visibility weight (0.0 to 1.0)" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Max(1)
	visibilityWeight!: number;

	@ApiProperty({ example: 0.15, description: "Thunderstorm weight (0.0 to 1.0)" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	@Max(1)
	thunderstormWeight!: number;

	@ApiProperty({ example: 0.5, description: "Max composite score for Green level" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	greenMaxScore!: number;

	@ApiProperty({ example: 1.2, description: "Max composite score for Yellow level" })
	@IsNumber()
	@IsNotEmpty()
	@Min(0)
	yellowMaxScore!: number;

	@ApiPropertyOptional({ example: true, description: "Automatically set as active rule version" })
	@IsBoolean()
	@IsOptional()
	isActive?: boolean;
}
