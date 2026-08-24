import { describe, expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapCreateCampsiteError } from "./useCreateCampsite";
import { mapUpdateCampsiteError } from "./useUpdateCampsite";

describe("mapCreateCampsiteError", () => {
	it("shows structured backend validation details for nested campsite fields", () => {
		const error = mapCreateCampsiteError(
			new HttpError("Unprocessable Entity", 422, {
				message: [
					{
						field: "media.0.url",
						errors: ["url must be a URL address"],
					},
				],
			})
		);

		expect(error.message).toBe("media.0.url: url must be a URL address");
		expect(error.canRetry).toBe(false);
	});
});

describe("mapUpdateCampsiteError", () => {
	it("preserves structured backend validation details", () => {
		const error = mapUpdateCampsiteError(
			new HttpError("Unprocessable Entity", 422, {
				message: [
					{
						field: "operatingHours.closesAt",
						errors: ["closesAt must be after opensAt"],
					},
				],
			})
		);

		expect(error.message).toBe("operatingHours.closesAt: closesAt must be after opensAt");
		expect(error.canRetry).toBe(false);
	});

	it("maps stale edit conflicts to a retryable UI error", () => {
		const error = mapUpdateCampsiteError(new HttpError("Conflict", 409, {}));

		expect(error.canRetry).toBe(true);
		expect(error.message).toContain("Dữ liệu bạn nhập vẫn được giữ nguyên");
	});
});
