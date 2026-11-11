import { ApiProperty } from "@nestjs/swagger";
import { UserProfileDto } from "./user-profile.dto";

/** AC1 (BR-009): valid credentials return an access token and a refresh
 * token. No `expiresAt` field — not requested by the spec. */
export class LoginResponseDto {
	@ApiProperty()
	accessToken!: string;

	@ApiProperty()
	refreshToken!: string;

	@ApiProperty({ type: UserProfileDto })
	user!: UserProfileDto;
}
