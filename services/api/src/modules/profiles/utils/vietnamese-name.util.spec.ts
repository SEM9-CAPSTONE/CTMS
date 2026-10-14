import { normalizeVietnameseName, validateAccountHolderNameMatch } from "./vietnamese-name.util";

describe("vietnamese-name.util", () => {
	describe("normalizeVietnameseName", () => {
		it("should normalize accents, convert đ/Đ to D, trim and uppercase", () => {
			expect(normalizeVietnameseName("Nguyễn Văn A")).toBe("NGUYEN VAN A");
			expect(normalizeVietnameseName("đặng thị hải yến")).toBe("DANG THI HAI YEN");
			expect(normalizeVietnameseName("  ĐỖ  ĐỨC   ĐẠT  ")).toBe("DO DUC DAT");
			expect(normalizeVietnameseName("VÕ VĂN ĐỒNG")).toBe("VO VAN DONG");
		});

		it("should handle plain ascii names properly", () => {
			expect(normalizeVietnameseName("JOHN DOE")).toBe("JOHN DOE");
			expect(normalizeVietnameseName("  john   doe  ")).toBe("JOHN DOE");
		});
	});

	describe("validateAccountHolderNameMatch (BR-351)", () => {
		it("should return true when registered full name and account holder name match regardless of accents or case", () => {
			expect(validateAccountHolderNameMatch("Nguyễn Văn A", "NGUYEN VAN A")).toBe(true);
			expect(validateAccountHolderNameMatch("nguyễn văn a", "nguyen van a")).toBe(true);
			expect(validateAccountHolderNameMatch("Đinh Khánh Linh", "DINH KHANH LINH")).toBe(true);
			expect(validateAccountHolderNameMatch("Trần Thị Thu Hà", "TRAN THI THU HA")).toBe(true);
			expect(validateAccountHolderNameMatch("Lê   Hoàng   Nam", "LE HOANG NAM")).toBe(true);
		});

		it("should return false when names do not match", () => {
			expect(validateAccountHolderNameMatch("Nguyễn Văn A", "NGUYEN VAN B")).toBe(false);
			expect(validateAccountHolderNameMatch("Trần Văn Nam", "LE HOANG NAM")).toBe(false);
			expect(validateAccountHolderNameMatch("Nguyễn A", "NGUYEN VAN A")).toBe(false);
		});

		it("should return false if registered full name is missing or empty", () => {
			expect(validateAccountHolderNameMatch(null, "NGUYEN VAN A")).toBe(false);
			expect(validateAccountHolderNameMatch(undefined, "NGUYEN VAN A")).toBe(false);
			expect(validateAccountHolderNameMatch("   ", "NGUYEN VAN A")).toBe(false);
		});

		it("should return false if account holder name is missing or empty", () => {
			expect(validateAccountHolderNameMatch("Nguyễn Văn A", null)).toBe(false);
			expect(validateAccountHolderNameMatch("Nguyễn Văn A", undefined)).toBe(false);
			expect(validateAccountHolderNameMatch("Nguyễn Văn A", "   ")).toBe(false);
		});
	});
});
