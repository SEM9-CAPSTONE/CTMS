import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import type { OtpNotificationProvider } from "./otp-notification-provider.interface";

/**
 * Real SMS delivery via Twilio's plain Programmable Messaging API — NOT
 * Twilio Verify. Verify would duplicate the OTP generate/hash/expiry/resend
 * limit lifecycle we already built and tested (AuthService.issueOtp), and
 * would give phone and email verification two different lifecycles. This
 * class only sends a message; it knows nothing about OTP business rules.
 *
 * The SDK client is built lazily on first send(), not in the constructor —
 * mirrors EmailOtpProvider's same defensive choice (see its docstring):
 * Twilio's constructor happens not to throw on empty credentials today
 * (verified), but deferring construction still means a missing/invalid key
 * only breaks an actual send attempt, never this provider's DI
 * instantiation, keeping that guarantee even if the SDK's own behavior
 * changes in a future version.
 */
@Injectable()
export class SmsOtpProvider implements OtpNotificationProvider {
	private readonly logger = new Logger(SmsOtpProvider.name);
	private client: ReturnType<typeof Twilio> | null = null;

	constructor(private readonly configService: ConfigService) {}

	private getClient(): ReturnType<typeof Twilio> {
		if (!this.client) {
			const accountSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
			const authToken = this.configService.get<string>("TWILIO_AUTH_TOKEN");
			this.client = Twilio(accountSid, authToken);
		}
		return this.client;
	}

	async send(destination: string, code: string): Promise<void> {
		const fromNumber = this.configService.get<string>("TWILIO_FROM_NUMBER") ?? "";

		try {
			// Twilio's SDK rejects the promise on any non-2xx response (RestException) --
			// that rejection is exactly what must propagate so the caller's
			// transaction rolls back (see AuthService.sendOtp).
			await this.getClient().messages.create({
				to: destination,
				from: fromNumber,
				body: `Ma xac minh CTMS cua ban la: ${code}. Ma co hieu luc trong thoi gian ngan, khong chia se voi bat ky ai.`,
			});
			// Never log `code` — only confirm dispatch happened, to whom.
			this.logger.log(`SMS OTP dispatched to ${destination}`);
		} catch (error) {
			this.logger.error(
				`SMS OTP dispatch failed for ${destination}`,
				error instanceof Error ? error.stack : undefined
			);
			throw error;
		}
	}
}
