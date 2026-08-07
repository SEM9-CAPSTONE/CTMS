import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import type { OtpNotificationProvider } from "./otp-notification-provider.interface";

/**
 * Real email delivery via Resend. Only sends a message; knows nothing about
 * OTP business rules (mirrors SmsOtpProvider's separation of concerns).
 *
 * Note (Resend SDK behavior, verified against its own .d.ts, not assumed):
 * unlike Twilio, Resend's client does NOT reject the promise on an API-level
 * failure -- it resolves with `{ data: null, error: {...} }`. This class
 * must explicitly check `.error` and throw, otherwise a failed send would
 * look like a success to AuthService.sendOtp() and the transaction would
 * incorrectly commit (defeating the whole "no send_count on failure" design).
 *
 * The SDK client is built lazily on first send(), not in the constructor —
 * Resend's constructor throws immediately on an empty/missing API key
 * (confirmed by running the real integration suite with a blank
 * RESEND_API_KEY), which would otherwise crash this provider's entire DI
 * instantiation at app/test-module boot time, taking down every unrelated
 * endpoint with it. Deferring construction means a missing key only breaks
 * an actual send attempt, not the whole app.
 */
@Injectable()
export class EmailOtpProvider implements OtpNotificationProvider {
	private readonly logger = new Logger(EmailOtpProvider.name);
	private client: Resend | null = null;

	constructor(private readonly configService: ConfigService) {}

	private getClient(): Resend {
		if (!this.client) {
			const apiKey = this.configService.get<string>("RESEND_API_KEY");
			this.client = new Resend(apiKey);
		}
		return this.client;
	}

	async send(destination: string, code: string): Promise<void> {
		const fromEmail = this.configService.get<string>("RESEND_FROM_EMAIL") ?? "";

		const { error } = await this.getClient().emails.send({
			to: destination,
			from: fromEmail,
			subject: "Ma xac minh tai khoan CTMS",
			html: `<p>Ma xac minh CTMS cua ban la: <strong>${code}</strong></p><p>Khong chia se ma nay voi bat ky ai.</p>`,
		});

		if (error) {
			this.logger.error(`Email OTP dispatch failed for ${destination}: ${error.message}`);
			throw new Error(`Email delivery failed: ${error.message}`);
		}

		// Never log `code` — only confirm dispatch happened, to whom.
		this.logger.log(`Email OTP dispatched to ${destination}`);
	}
}
