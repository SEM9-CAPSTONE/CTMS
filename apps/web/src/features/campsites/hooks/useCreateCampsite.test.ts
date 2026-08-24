import { describe, expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapCreateCampsiteError } from "./useCreateCampsite";

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
