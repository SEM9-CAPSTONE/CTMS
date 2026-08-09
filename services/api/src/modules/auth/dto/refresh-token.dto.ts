import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

/**
 * CTMS-04-T01, DG-01: refresh token is transported in the request body, not
 * a header/cookie. No format validation beyond non-empty string -- the raw
 * value is opaque to the client (see refresh-token.entity.ts's doc comment:
 * only its SHA-256 hash is ever compared server-side).
 */
export class RefreshTokenDto {
	@ApiProperty()
	@IsNotEmpty()
	@IsString()
	refreshToken!: string;
}
