import type { ConfigService } from "@nestjs/config";
import { Resend } from "resend";
import { EmailOtpProvider } from "./email-otp.provider";

jest.mock("resend");

function buildConfigService(): ConfigService {
	const values: Record<string, string> = {
		RESEND_API_KEY: "re_test_key",
		RESEND_FROM_EMAIL: "otp@ctms.example.com",
	};
	return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe("EmailOtpProvider", () => {
	let emailsSend: jest.Mock;

	beforeEach(() => {
		emailsSend = jest.fn();
		(Resend as unknown as jest.Mock).mockImplementation(() => ({
			emails: { send: emailsSend },
		}));
	});

	it("sends via Resend with the destination, configured from-address, and the code embedded in the HTML body", async () => {
		emailsSend.mockResolvedValue({ data: { id: "email_test" }, error: null });
		const provider = new EmailOtpProvider(buildConfigService());

		await provider.send("camper@example.com", "123456");

		expect(emailsSend).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "camper@example.com",
				from: "otp@ctms.example.com",
				html: expect.stringContaining("123456"),
			})
		);
	});

	// Resend's SDK resolves with { data: null, error: {...} } on API failure
	// instead of rejecting -- confirmed against its own .d.ts, not assumed.
	// EmailOtpProvider must translate that into a thrown error, otherwise a
	// failed send would look like a success to AuthService.sendOtp().
	it("throws when Resend resolves with an error object instead of rejecting", async () => {
		emailsSend.mockResolvedValue({
			data: null,
			error: { message: "Invalid from address", statusCode: 422, name: "invalid_from_address" },
		});
		const provider = new EmailOtpProvider(buildConfigService());

		await expect(provider.send("camper@example.com", "123456")).rejects.toThrow(
			"Invalid from address"
		);
	});
});
