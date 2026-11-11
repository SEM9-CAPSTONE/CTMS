import { describe, expect, it } from "vitest";
import { normalizeVietnameseName, validateAccountHolderNameMatch } from "./vietnamese-name.util";

describe("normalizeVietnameseName (frontend)", () => {
	it("removes accents and converts to uppercase", () => {
		expect(normalizeVietnameseName("Nguyễn Văn A")).toBe("NGUYEN VAN A");
		expect(normalizeVietnameseName("Trần Thị Thu Hà")).toBe("TRAN THI THU HA");
	});

	it("handles Vietnamese letter Đ / đ correctly", () => {
		expect(normalizeVietnameseName("Đỗ Đăng Định")).toBe("DO DANG DINH");
		expect(normalizeVietnameseName("đặng đình đức")).toBe("DANG DINH DUC");
	});

	it("normalizes multiple whitespace and trims", () => {
		expect(normalizeVietnameseName("   Lê   Hoàng    Nam   ")).toBe("LE HOANG NAM");
	});
});

describe("validateAccountHolderNameMatch (frontend)", () => {
	it("returns true when normalized names match exactly", () => {
		expect(validateAccountHolderNameMatch("NGUYEN VAN A", "Nguyễn Văn A")).toBe(true);
		expect(validateAccountHolderNameMatch("nguyen van a", "NGUYỄN VĂN A")).toBe(true);
		expect(validateAccountHolderNameMatch("TRAN THI THU HA", "Trần Thị Thu Hà")).toBe(true);
	});

	it("returns false when names do not match", () => {
		expect(validateAccountHolderNameMatch("NGUYEN VAN B", "Nguyễn Văn A")).toBe(false);
		expect(validateAccountHolderNameMatch("LE THI C", "Trần Thị Thu Hà")).toBe(false);
	});

	it("returns false when empty", () => {
		expect(validateAccountHolderNameMatch("", "Nguyễn Văn A")).toBe(false);
		expect(validateAccountHolderNameMatch("NGUYEN VAN A", "")).toBe(false);
	});
});
