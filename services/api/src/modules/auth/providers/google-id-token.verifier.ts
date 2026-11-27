import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";

/** What CTMS needs from a verified Google ID token. */
export interface GoogleIdentity {
	/** Stable Google account id (`sub`); survives a change of e-mail. */
	subject: string;
	email: string;
	emailVerified: boolean;
	name: string | null;
	picture: string | null;
}

/**
 * Verifies a Google Sign-In ID token (signature, expiry, issuer and audience)
 * with Google's official library. Accepted audiences come from
 * `GOOGLE_CLIENT_IDS` (comma-separated OAuth client ids: the web client, which is
 * also the `serverClientId` the mobile app asks tokens for). Returns `null` for
 * any invalid token, never throws for bad input. Tests replace this provider.
 */
@Injectable()
export class GoogleIdTokenVerifier {
	private readonly logger = new Logger(GoogleIdTokenVerifier.name);
	private readonly client = new OAuth2Client();

	constructor(private readonly configService: ConfigService) {}

	/** Client ids allowed as token audience; empty means Google sign-in is off. */
	audiences(): string[] {
		return (this.configService.get<string>("GOOGLE_CLIENT_IDS") ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
	}

	isEnabled(): boolean {
		return this.audiences().length > 0;
	}

	async verify(idToken: string): Promise<GoogleIdentity | null> {
		const audience = this.audiences();
		if (audience.length === 0) return null;
		try {
			const ticket = await this.client.verifyIdToken({ idToken, audience });
			const payload = ticket.getPayload();
			if (!payload?.sub || !payload.email) return null;
			return {
				subject: payload.sub,
				email: payload.email,
				emailVerified: payload.email_verified === true,
				name: payload.name ?? null,
				picture: payload.picture ?? null,
			};
		} catch (error) {
			this.logger.warn(`Rejected Google ID token: ${(error as Error).message}`);
			return null;
		}
	}
}
