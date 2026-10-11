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
		getBookingRefundInfo: jest.Mock;
		listAdminRefunds: jest.Mock;
		confirmManualRefund: jest.Mock;
		rejectRefund: jest.Mock;
	};

	beforeEach(() => {
		refundsService = {
			processRefund: jest.fn(),
			reconcileProviderRefundCallback: jest.fn(),
			getSettlementStatus: jest.fn(),
			getBookingRefundInfo: jest.fn(),
			listAdminRefunds: jest.fn(),
			confirmManualRefund: jest.fn(),
			rejectRefund: jest.fn(),
		};
		controller = new RefundsController(refundsService as unknown as RefundsService);
	});

	it("delegates getBookingRefundInfo to service with user ID, roles, and bookingId", async () => {
		const mockInfo = {
			bookingId: "b-1",
			isEligible: true,
			origin: RefundOrigin.CAMPER_CANCELLATION,
			totalRefundedAmount: "0.00",
			remainingRefundableAmount: "50.00",
			refunds: [],
			settlementBlocked: false,
			awaitingResolution: false,
		};
		refundsService.getBookingRefundInfo.mockResolvedValue(mockInfo);

		const res = await controller.getBookingRefundInfo(
			{
				user: {
					userId: "user-1",
					email: "camper@example.com",
					roles: ["camper"],
				} as unknown as AuthenticatedUser,
			},
			"b-1"
		);

		expect(res).toBe(mockInfo);
		expect(refundsService.getBookingRefundInfo).toHaveBeenCalledWith("user-1", ["camper"], "b-1");
	});

	it("delegates processRefund to service with user ID, body, and userRoles", async () => {
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
		expect(refundsService.processRefund).toHaveBeenCalledWith("admin-1", "b-1", "key-1", dto, {
			userRoles: [],
		});
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

	it("delegates listAdminRefunds to service", async () => {
		const mockList = {
			items: [],
			total: 0,
			page: 1,
			limit: 20,
			totalPages: 0,
		};
		refundsService.listAdminRefunds.mockResolvedValue(mockList);

		const query = { page: 1, limit: 20 };
		const res = await controller.listAdminRefunds(query);

		expect(res).toBe(mockList);
		expect(refundsService.listAdminRefunds).toHaveBeenCalledWith(query);
	});

	it("delegates confirmManualRefund to service", async () => {
		const mockResponse = {
			refundId: "ob-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: PaymentStatus.SUCCEEDED,
			transactionStatus: PaymentTransactionStatus.SUCCEEDED,
			providerReference: "VCB-REF-1",
			policySource: "admin_manual_transfer",
			createdAt: new Date(),
		};
		refundsService.confirmManualRefund.mockResolvedValue(mockResponse);

		const res = await controller.confirmManualRefund(
			{
				user: {
					userId: "admin-1",
					email: "admin@ctms.local",
					roles: [],
				} as unknown as AuthenticatedUser,
			},
			"ob-1",
			{ transactionRef: "VCB-REF-1", note: "App transfer" }
		);

		expect(res).toBe(mockResponse);
		expect(refundsService.confirmManualRefund).toHaveBeenCalledWith("admin-1", "ob-1", {
			transactionRef: "VCB-REF-1",
			note: "App transfer",
		});
	});

	it("delegates rejectRefund to service", async () => {
		const mockResponse = {
			refundId: "ob-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: PaymentStatus.FAILED,
			transactionStatus: PaymentTransactionStatus.FAILED,
			providerReference: null,
			policySource: "admin_rejection",
			createdAt: new Date(),
		};
		refundsService.rejectRefund.mockResolvedValue(mockResponse);

		const res = await controller.rejectRefund(
			{
				user: {
					userId: "admin-1",
					email: "admin@ctms.local",
					roles: [],
				} as unknown as AuthenticatedUser,
			},
			"ob-1",
			{ rejectionReason: "Invalid request" }
		);

		expect(res).toBe(mockResponse);
		expect(refundsService.rejectRefund).toHaveBeenCalledWith("admin-1", "ob-1", {
			rejectionReason: "Invalid request",
		});
	});
});
