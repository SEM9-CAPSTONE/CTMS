import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class GoogleLoginDto {
	@ApiProperty({
		description:
			"Google Sign-In ID token (the `credential` from Google Identity Services on web, `idToken` from google_sign_in on mobile)",
	})
	@IsNotEmpty()
	@IsString()
	@MaxLength(4096)
	idToken!: string;
}
