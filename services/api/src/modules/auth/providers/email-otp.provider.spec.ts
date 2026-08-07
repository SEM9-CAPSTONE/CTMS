import type { ConfigService } from "@nestjs/config";
import { createTransport } from "nodemailer";
import { EmailOtpProvider } from "./email-otp.provider";

jest.mock("nodemailer");

function buildConfigService(): ConfigService {
	const values: Record<string, string> = {
		SMTP_HOST: "smtp.gmail.com",
		SMTP_PORT: "587",
		SMTP_SECURE: "false",
		SMTP_USER: "ctms.test@gmail.com",
		SMTP_PASSWORD: "app-password-value",
		SMTP_FROM_EMAIL: "otp@ctms.example.com",
	};
	return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe("EmailOtpProvider", () => {
	let sendMail: jest.Mock;

	beforeEach(() => {
		sendMail = jest.fn();
		(createTransport as unknown as jest.Mock).mockReset().mockReturnValue({ sendMail });
	});

	it("sends via SMTP with the destination, configured from-address, and the code embedded in the HTML body", async () => {
		sendMail.mockResolvedValue({ messageId: "email_test" });
		const provider = new EmailOtpProvider(buildConfigService());

		await provider.send("camper@example.com", "123456");

		expect(createTransport).toHaveBeenCalledWith(
			expect.objectContaining({
				host: "smtp.gmail.com",
				port: 587,
				secure: false,
				auth: { user: "ctms.test@gmail.com", pass: "app-password-value" },
			})
		);
		expect(sendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "camper@example.com",
				from: "otp@ctms.example.com",
				html: expect.stringContaining("123456"),
			})
		);
	});

	// nodemailer's sendMail() rejects the promise on an SMTP-level failure
	// (unlike Resend, which resolved with an error object) — EmailOtpProvider
	// must translate the rejection into a stable, prefixed error message.
	it("throws a stable error message when sendMail rejects", async () => {
		sendMail.mockRejectedValue(
			new Error("Invalid login: 535-5.7.8 Username and Password not accepted")
		);
		const provider = new EmailOtpProvider(buildConfigService());

		await expect(provider.send("camper@example.com", "123456")).rejects.toThrow(
			"Email delivery failed: Invalid login: 535-5.7.8 Username and Password not accepted"
		);
	});

	it("builds the transporter only once across multiple sends", async () => {
		sendMail.mockResolvedValue({ messageId: "email_test" });
		const provider = new EmailOtpProvider(buildConfigService());

		await provider.send("camper@example.com", "111111");
		await provider.send("camper2@example.com", "222222");

		expect(createTransport).toHaveBeenCalledTimes(1);
	});
});
