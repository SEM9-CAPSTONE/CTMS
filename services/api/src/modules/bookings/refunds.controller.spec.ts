import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { PaymentStatus, PaymentTransactionStatus } from "./entities/payment.entity";
import { RefundOrigin } from "./refund-policy";
import { RefundsController } from "./refunds.controller";
import type { RefundsService } from "./refunds.service";

describe("RefundsController (CTMS-035)", () => {
	let controller: RefundsController;
	let refundsService: {
		processRefund: jest.Mock;
		reconcileProviderRefundCallback: jest.Mock;
		getSettlementStatus: jest.Mock;
	};

	beforeEach(() => {
		refundsService = {
			processRefund: jest.fn(),
			reconcileProviderRefundCallback: jest.fn(),
			getSettlementStatus: jest.fn(),
		};
		controller = new RefundsController(refundsService as unknown as RefundsService);
	});

	it("delegates processRefund to service with user ID and body", async () => {
		const mockResponse = {
			refundId: "ref-1",
			bookingId: "b-1",
			parentPaymentId: "c-1",
			amount: "50.00",
			status: PaymentStatus.SUCCEEDED,
			transactionStatus: PaymentTransactionStatus.SUCCEEDED,
			providerReference: "p-ref-1",
			policySource: "booking_cancellation_policy",
			createdAt: new Date(),
		};
		refundsService.processRefund.mockResolvedValue(mockResponse);

		const dto = {
			amount: "50.00",
			origin: RefundOrigin.CAMPER_CANCELLATION,
		};

		const res = await controller.processRefund(
			{
				user: {
					userId: "admin-1",
					email: "admin@example.com",
					roles: [],
				} as unknown as AuthenticatedUser,
			},
			"b-1",
			"key-1",
			dto
		);

		expect(res).toBe(mockResponse);
		expect(refundsService.processRefund).toHaveBeenCalledWith("admin-1", "b-1", "key-1", dto);
	});

	it("delegates processObligation to service with obligationId", async () => {
		const mockResponse = {
			refundId: "ob-1",
			bookingId: "b-1",
			parentPaymentId: "c-1",
			amount: "40.00",
			status: PaymentStatus.SUCCEEDED,
			transactionStatus: PaymentTransactionStatus.SUCCEEDED,
			providerReference: "p-ref-2",
			policySource: "booking_cancellation_policy",
			createdAt: new Date(),
		};
		refundsService.processRefund.mockResolvedValue(mockResponse);

		const res = await controller.processObligation(
			{
				user: {
					userId: "admin-1",
					email: "admin@example.com",
					roles: [],
				} as unknown as AuthenticatedUser,
			},
			"b-1",
			"ob-1",
			"key-1",
			{}
		);

		expect(res).toBe(mockResponse);
		expect(refundsService.processRefund).toHaveBeenCalledWith("admin-1", "b-1", "key-1", {
			obligationId: "ob-1",
		});
	});

	it("delegates getSettlementStatus to service", async () => {
		const mockStatus = {
			tripId: "t-1",
			isBlocked: false,
			blockingReasons: [],
			blockingPaymentIds: [],
			totalCharges: "100.00",
			totalSucceededRefunds: "0.00",
			heldFunds: "100.00",
			settlementBase: "100.00",
		};
		refundsService.getSettlementStatus.mockResolvedValue(mockStatus);

		const res = await controller.getSettlementStatus("t-1");
		expect(res).toBe(mockStatus);
		expect(refundsService.getSettlementStatus).toHaveBeenCalledWith("t-1");
	});

	it("delegates handleRefundWebhook to service", async () => {
		refundsService.reconcileProviderRefundCallback.mockResolvedValue({
			success: true,
			replayed: false,
		});

		const res = await controller.handleRefundWebhook({
			providerReference: "prov-1",
			isSuccess: true,
		});

		expect(res).toEqual({ success: true, replayed: false });
		expect(refundsService.reconcileProviderRefundCallback).toHaveBeenCalledWith({
			providerReference: "prov-1",
			isSuccess: true,
		});
	});
});
