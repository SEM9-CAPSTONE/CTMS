import { describe, expect, it } from "vitest";
import { formatWalletDescription } from "./wallet-description";

describe("wallet transaction description", () => {
	it.each(["a1736fee-62be-4991-9478-a62288e9b80a", "a1736fee"])(
		"replaces legacy trip reference %s with the trip title and keeps notes",
		(reference) => {
			expect(
				formatWalletDescription(
					`Quyết toán thành công chuyến đi #${reference}. Đã đối chiếu doanh thu.`,
					"Khám phá bán đảo Sơn Trà"
				)
			).toBe("Quyết toán thành công chuyến đi: Khám phá bán đảo Sơn Trà. Đã đối chiếu doanh thu.");
		}
	);
	it("shows missing trip information instead of a shortened UUID", () => {
		expect(formatWalletDescription("Quyết toán doanh thu chuyến đi #a1736fee")).toBe(
			"Quyết toán doanh thu chuyến đi: Chưa có thông tin chuyến đi"
		);
	});
	it("preserves a description that already uses the trip title", () => {
		expect(
			formatWalletDescription(
				"Quyết toán doanh thu chuyến đi: Khám phá bán đảo Sơn Trà",
				"Khám phá bán đảo Sơn Trà"
			)
		).toBe("Quyết toán doanh thu chuyến đi: Khám phá bán đảo Sơn Trà");
	});
	it("preserves the reason without exposing legacy shortened UUIDs", () => {
		expect(
			formatWalletDescription(
				"Ghi nhận nợ thu hồi sau rút tiền - Payout d1140000: Hoàn lại khoản thu thừa"
			)
		).toBe("Ghi nhận nợ thu hồi sau rút tiền: Hoàn lại khoản thu thừa");
	});
	it("keeps actual bank references", () => {
		expect(formatWalletDescription("Chuyển khoản ngân hàng FT261113001")).toBe(
			"Chuyển khoản ngân hàng FT261113001"
		);
	});
});
