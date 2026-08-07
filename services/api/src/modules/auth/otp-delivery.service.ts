import { Inject, Injectable } from "@nestjs/common";
import { OtpChannel } from "./dto/send-otp.dto";
import {
	EMAIL_OTP_PROVIDER,
	type OtpNotificationProvider,
	SMS_OTP_PROVIDER,
} from "./providers/otp-notification-provider.interface";

/** The subset of User fields delivery needs — not the whole entity, so this
 * service doesn't need to know about User beyond its two contact fields. */
export interface OtpDeliveryTarget {
	email: string | null;
	phone: string | null;
}

/**
 * The only thing in this module that knows "phone -> SmsOtpProvider" and
 * "email -> EmailOtpProvider". AuthService talks only to this service, never
 * to Twilio/SMTP directly (see otp-notification-provider.interface.ts for
 * why). Adding a new channel later (Telegram, WhatsApp, Zalo, Push) means
 * one new provider class + one new branch here — AuthService never changes.
 */
@Injectable()
export class OtpDeliveryService {
	constructor(
		@Inject(SMS_OTP_PROVIDER) private readonly smsProvider: OtpNotificationProvider,
		@Inject(EMAIL_OTP_PROVIDER) private readonly emailProvider: OtpNotificationProvider
	) {}

	async send(channel: OtpChannel, target: OtpDeliveryTarget, code: string): Promise<void> {
		if (channel === OtpChannel.EMAIL) {
			if (!target.email) {
				throw new Error("Cannot deliver OTP by email: user has no email on file");
			}
			await this.emailProvider.send(target.email, code);
			return;
		}

		if (!target.phone) {
			throw new Error("Cannot deliver OTP by phone: user has no phone on file");
		}
		await this.smsProvider.send(target.phone, code);
	}
}
