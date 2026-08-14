import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class LogoutDto {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	refreshToken!: string;

	@ApiPropertyOptional({ default: false })
	@IsOptional()
	@IsBoolean()
	allDevices?: boolean;
}
