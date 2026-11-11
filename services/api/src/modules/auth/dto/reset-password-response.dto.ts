import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordResponseDto {
	@ApiProperty()
	passwordReset!: boolean;
}
