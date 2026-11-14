import { describe, expect, it } from "vitest";
import { formatWalletDescription } from "./wallet-description";

describe("wallet transaction description", () => {
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
