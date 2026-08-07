import type { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import { SmsOtpProvider } from "./sms-otp.provider";

jest.mock("twilio");

function buildConfigService(): ConfigService {
	const values: Record<string, string> = {
		TWILIO_ACCOUNT_SID: "AC_test_sid",
		TWILIO_AUTH_TOKEN: "test_auth_token",
		TWILIO_FROM_NUMBER: "+15005550006",
	};
	return { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
}

describe("SmsOtpProvider", () => {
	let messagesCreate: jest.Mock;

	beforeEach(() => {
		messagesCreate = jest.fn();
		(Twilio as unknown as jest.Mock).mockReturnValue({
			messages: { create: messagesCreate },
		});
	});

	it("sends via Twilio with the destination, configured from-number, and the code embedded in the body", async () => {
		messagesCreate.mockResolvedValue({ sid: "SM_test" });
		const provider = new SmsOtpProvider(buildConfigService());

		await provider.send("+84912345678", "123456");

		expect(messagesCreate).toHaveBeenCalledWith({
			to: "+84912345678",
			from: "+15005550006",
			body: expect.stringContaining("123456"),
		});
	});

	it("propagates the error when Twilio's client rejects (invalid number, network failure, etc.)", async () => {
		const twilioError = new Error("Twilio: Invalid 'To' Phone Number");
		messagesCreate.mockRejectedValue(twilioError);
		const provider = new SmsOtpProvider(buildConfigService());

		await expect(provider.send("+84000000000", "123456")).rejects.toThrow(twilioError);
	});
});
