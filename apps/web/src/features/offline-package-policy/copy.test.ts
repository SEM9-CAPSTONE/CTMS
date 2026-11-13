import { describe, expect, it } from "vitest";
import { DEPARTURE_REASON_LABELS, departureReasonLabel, departureTime } from "./copy";

const codes = [
	"PACKAGE_TRIP_MISMATCH",
	"PACKAGE_HASH_MISMATCH",
	"PACKAGE_ARTIFACT_UNAVAILABLE",
	"PACKAGE_UPDATE_REQUIRED",
	"PACKAGE_VERSION_LOCKED",
	"PACKAGE_TRIP_NOT_PUBLISHED",
	"DEPARTURE_RESPONSIBLE_PORTER_REQUIRED",
	"PACKAGE_ACTIVATION_REQUIRED",
	"PACKAGE_DEPARTURE_NOT_READY",
	"SOURCE_FRESHNESS_UNAVAILABLE",
	"PACKAGE_SOURCE_EXPIRED",
	"NO_REQUIRED_PACKAGE",
	"PACKAGE_DEPARTURE_READY",
];
describe("Departure Vietnamese copy", () => {
	it.each(codes)("translates %s without displaying the raw reason", (code) => {
		expect(DEPARTURE_REASON_LABELS[code]).toBeTruthy();
		expect(departureReasonLabel(code)).not.toContain(code);
		expect(departureReasonLabel(code)).not.toMatch(/[A-Z]+_[A-Z_]+/);
		expect(departureReasonLabel(code)).toMatch(/[à-ỹ]/);
	});
	it("uses a safe Vietnamese fallback for a future reason code", () => {
		expect(departureReasonLabel("FUTURE_REASON_CODE")).toBe(
			"Chưa thể khởi hành, vui lòng liên hệ chủ chuyến"
		);
	});
	it("uses Asia/Ho_Chi_Minh with day first and no seconds", () => {
		expect(departureTime("2026-11-12T03:00:59Z")).toBe("12/11/2026 10:00");
		expect(departureTime("2026-11-12T10:00:59+07:00")).toBe("12/11/2026 10:00");
		expect(departureTime("RAW_INVALID_TIMESTAMP")).toBe("Chưa xác định");
	});
});
