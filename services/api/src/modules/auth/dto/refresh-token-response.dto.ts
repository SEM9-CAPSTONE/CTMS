import { ApiProperty } from "@nestjs/swagger";

/**
 * CTMS-04-T01, DG-01: no `user` field -- unlike LoginResponseDto, refresh
 * has no new profile data to hand back, only a rotated token pair
 * (DG-02: rotation is mandatory on every refresh).
 */
export class RefreshTokenResponseDto {
	@ApiProperty()
	accessToken!: string;

	@ApiProperty()
	refreshToken!: string;
}
