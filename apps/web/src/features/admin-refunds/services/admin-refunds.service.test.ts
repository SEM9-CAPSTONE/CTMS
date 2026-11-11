import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../core/api";
import { adminRefundsService } from "./admin-refunds.service";

describe("adminRefundsService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("fetches refunds with filters via GET /admin/refunds", async () => {
		const mockResponse = {
			items: [],
			total: 0,
			page: 1,
			limit: 15,
			totalPages: 0,
		};
		vi.spyOn(httpClient, "get").mockResolvedValue(mockResponse);

		const result = await adminRefundsService.getRefunds({
			page: 1,
			limit: 15,
			status: "pending",
			search: "camper",
		});

		expect(httpClient.get).toHaveBeenCalledWith("/admin/refunds", {
			page: 1,
			limit: 15,
			status: "pending",
			search: "camper",
		});
		expect(result).toBe(mockResponse);
	});

	it("confirms manual transfer via POST /admin/refunds/:id/confirm", async () => {
		const mockResponse = {
			refundId: "r-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: "succeeded",
			transactionStatus: "succeeded",
			providerReference: "VCB123456",
			policySource: "admin_manual_transfer",
		};
		vi.spyOn(httpClient, "post").mockResolvedValue(mockResponse);

		const result = await adminRefundsService.confirmTransfer("r-1", {
			transactionRef: "VCB123456",
			note: "Đã chuyển qua app Vietcombank",
		});

		expect(httpClient.post).toHaveBeenCalledWith("/admin/refunds/r-1/confirm", {
			transactionRef: "VCB123456",
			note: "Đã chuyển qua app Vietcombank",
		});
		expect(result).toBe(mockResponse);
	});

	it("rejects refund via POST /admin/refunds/:id/reject", async () => {
		const mockResponse = {
			refundId: "r-1",
			bookingId: "b-1",
			parentPaymentId: "p-1",
			amount: "500000.00",
			status: "failed",
			transactionStatus: "failed",
			providerReference: null,
			policySource: "admin_rejection",
		};
		vi.spyOn(httpClient, "post").mockResolvedValue(mockResponse);

		const result = await adminRefundsService.rejectRefund("r-1", {
			rejectionReason: "Không thuộc diện hoàn tiền theo chính sách",
		});

		expect(httpClient.post).toHaveBeenCalledWith("/admin/refunds/r-1/reject", {
			rejectionReason: "Không thuộc diện hoàn tiền theo chính sách",
		});
		expect(result).toBe(mockResponse);
	});
});
