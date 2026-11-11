import { OtpChannel } from "./dto/send-otp.dto";
import { OtpDeliveryService } from "./otp-delivery.service";
import type { OtpNotificationProvider } from "./providers/otp-notification-provider.interface";

function buildProvider(): jest.Mocked<OtpNotificationProvider> {
	return { send: jest.fn() };
}

describe("OtpDeliveryService", () => {
	let smsProvider: jest.Mocked<OtpNotificationProvider>;
	let emailProvider: jest.Mocked<OtpNotificationProvider>;
	let service: OtpDeliveryService;

	beforeEach(() => {
		smsProvider = buildProvider();
		emailProvider = buildProvider();
		service = new OtpDeliveryService(smsProvider, emailProvider);
	});

	it("routes to SmsOtpProvider with the user's phone when channel is PHONE", async () => {
		await service.send(
			OtpChannel.PHONE,
			{ email: "a@example.com", phone: "+84912345678" },
			"123456"
		);

		expect(smsProvider.send).toHaveBeenCalledWith("+84912345678", "123456");
		expect(emailProvider.send).not.toHaveBeenCalled();
	});

	it("routes to EmailOtpProvider with the user's email when channel is EMAIL", async () => {
		await service.send(
			OtpChannel.EMAIL,
			{ email: "a@example.com", phone: "+84912345678" },
			"123456"
		);

		expect(emailProvider.send).toHaveBeenCalledWith("a@example.com", "123456");
		expect(smsProvider.send).not.toHaveBeenCalled();
	});

	it("throws without calling any provider when channel is PHONE but the user has no phone on file", async () => {
		await expect(
			service.send(OtpChannel.PHONE, { email: "a@example.com", phone: null }, "123456")
		).rejects.toThrow(/no phone/i);
		expect(smsProvider.send).not.toHaveBeenCalled();
	});

	it("throws without calling any provider when channel is EMAIL but the user has no email on file", async () => {
		await expect(
			service.send(OtpChannel.EMAIL, { email: null, phone: "+84912345678" }, "123456")
		).rejects.toThrow(/no email/i);
		expect(emailProvider.send).not.toHaveBeenCalled();
	});

	it("propagates the provider's rejection unchanged (so the caller's transaction can roll back)", async () => {
		const providerError = new Error("Twilio: Invalid 'To' Phone Number");
		smsProvider.send.mockRejectedValue(providerError);

		await expect(
			service.send(OtpChannel.PHONE, { email: "a@example.com", phone: "+84912345678" }, "123456")
		).rejects.toThrow(providerError);
	});
});
