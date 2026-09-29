import { BadRequestException } from "@nestjs/common";
import { PaymentWebhookController } from "./payment-webhook.controller";
import type { PaymentsService } from "./payments.service";
import type { PayOSService } from "./payos.service";

describe("PaymentWebhookController", () => {
	let controller: PaymentWebhookController;
	let payosService: {
		isConfigured: jest.Mock;
		verifyWebhook: jest.Mock;
	};
	let paymentsService: {
		handlePayOSWebhook: jest.Mock;
	};

	beforeEach(() => {
		payosService = {
			isConfigured: jest.fn().mockReturnValue(true),
			verifyWebhook: jest.fn(),
		};
		paymentsService = {
			handlePayOSWebhook: jest.fn().mockResolvedValue(undefined),
		};

		controller = new PaymentWebhookController(
			payosService as unknown as PayOSService,
			paymentsService as unknown as PaymentsService
		);
	});

	it("returns success: true when PayOS is not configured", async () => {
		payosService.isConfigured.mockReturnValue(false);

		const result = await controller.handleWebhook({
			code: "00",
			desc: "success",
			success: true,
			data: {
				orderCode: 123456,
				amount: 500000,
				description: "CTMS",
				accountNumber: "123",
				reference: "ref-1",
				transactionDateTime: "2026-09-29",
				currency: "VND",
				paymentLinkId: "link-1",
				code: "00",
				desc: "success",
			},
			signature: "sig-123",
		});

		expect(result).toEqual({ success: true });
		expect(payosService.verifyWebhook).not.toHaveBeenCalled();
	});

	it("verifies webhook payload and passes data to paymentsService.handlePayOSWebhook", async () => {
		const webhookData = {
			orderCode: 999888,
			amount: 1000000,
			description: "CTMS Booking",
			accountNumber: "9704",
			reference: "FT12345",
			transactionDateTime: "2026-09-29T22:00:00Z",
			currency: "VND",
			paymentLinkId: "link-xyz",
			code: "00",
			desc: "success",
		};
		payosService.verifyWebhook.mockResolvedValue(webhookData);

		const result = await controller.handleWebhook({
			code: "00",
			desc: "success",
			success: true,
			data: webhookData,
			signature: "valid-sig",
		});

		expect(result).toEqual({ success: true });
		expect(payosService.verifyWebhook).toHaveBeenCalled();
		expect(paymentsService.handlePayOSWebhook).toHaveBeenCalledWith(webhookData);
	});

	it("throws BadRequestException when webhook signature or data is invalid", async () => {
		payosService.verifyWebhook.mockRejectedValue(new Error("Data not integrity"));

		await expect(
			controller.handleWebhook({
				code: "00",
				desc: "success",
				success: true,
				data: {
					orderCode: 111,
					amount: 10000,
					description: "CTMS",
					accountNumber: "9704",
					reference: "FT",
					transactionDateTime: "now",
					currency: "VND",
					paymentLinkId: "link",
					code: "00",
					desc: "success",
				},
				signature: "tampered-sig",
			})
		).rejects.toThrow(BadRequestException);
	});
});
