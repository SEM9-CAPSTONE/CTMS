/**
 * A pure "send this message to this destination" contract. Deliberately
 * knows nothing about OTPs, users, or channels-vs-contact-field mapping —
 * that routing lives in OtpDeliveryService, not here. Adding a new delivery
 * channel later (Telegram, WhatsApp, Zalo, Push) means implementing this
 * interface once, nothing else in auth.service.ts changes.
 */
export interface OtpNotificationProvider {
	send(destination: string, code: string): Promise<void>;
}

/** DI tokens — the interface above has no runtime representation, so NestJS
 * needs a concrete token to inject by. */
export const SMS_OTP_PROVIDER = Symbol("SMS_OTP_PROVIDER");
export const EMAIL_OTP_PROVIDER = Symbol("EMAIL_OTP_PROVIDER");
