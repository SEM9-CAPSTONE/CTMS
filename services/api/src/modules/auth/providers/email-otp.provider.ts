import { Injectable, Logger } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import { type Transporter, createTransport } from "nodemailer";
import type { OtpNotificationProvider } from "./otp-notification-provider.interface";

/**
 * Real email delivery via plain SMTP (nodemailer) — no domain
 * verification required, unlike the previous Resend-based implementation.
 * Works with any SMTP server (Gmail App Password, Outlook, Mailtrap, a
 * company mail server, ...). Only sends a message; knows nothing about OTP
 * business rules (mirrors SmsOtpProvider's separation of concerns).
 *
 * The transporter is built lazily on first send(), not in the constructor —
 * same reasoning as the previous Resend provider: failing fast on a
 * missing/blank SMTP_HOST would otherwise crash this provider's entire DI
 * instantiation at app/test-module boot time, taking down every unrelated
 * endpoint with it. Deferring construction means a missing config only
 * breaks an actual send attempt, not the whole app. nodemailer itself
 * doesn't validate the config until a real `sendMail()` call touches the
 * network, so this defers just the object construction for consistency.
 */
@Injectable()
export class EmailOtpProvider implements OtpNotificationProvider {
	private readonly logger = new Logger(EmailOtpProvider.name);
	private transporter: Transporter | null = null;

	constructor(private readonly configService: ConfigService) {}

	private getTransporter(): Transporter {
		if (!this.transporter) {
			this.transporter = createTransport({
				host: this.configService.get<string>("SMTP_HOST"),
				port: Number(this.configService.get<string>("SMTP_PORT") ?? "587"),
				// SMTP_SECURE=true -> implicit TLS (port 465). Plain/STARTTLS
				// (port 587, the common default) must be false here.
				secure: this.configService.get<string>("SMTP_SECURE") === "true",
				auth: {
					user: this.configService.get<string>("SMTP_USER"),
					pass: this.configService.get<string>("SMTP_PASSWORD"),
				},
			});
		}
		return this.transporter;
	}

	async send(destination: string, code: string): Promise<void> {
		const fromEmail = this.configService.get<string>("SMTP_FROM_EMAIL") ?? "";

		try {
			await this.getTransporter().sendMail({
				to: destination,
				from: fromEmail,
				subject: "Ma xac minh tai khoan CTMS",
				html: `<p>Ma xac minh CTMS cua ban la: <strong>${code}</strong></p><p>Khong chia se ma nay voi bat ky ai.</p>`,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown SMTP error";
			this.logger.error(`Email OTP dispatch failed for ${destination}: ${message}`);
			throw new Error(`Email delivery failed: ${message}`);
		}

		// Never log `code` — only confirm dispatch happened, to whom.
		this.logger.log(`Email OTP dispatched to ${destination}`);
	}
}
