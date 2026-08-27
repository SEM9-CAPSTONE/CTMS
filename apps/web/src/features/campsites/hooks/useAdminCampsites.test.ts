import { describe, expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapReviewCampsiteError } from "./useAdminCampsites";

describe("mapReviewCampsiteError", () => {
	it("maps 401 unauthenticated error correctly", () => {
		const error = mapReviewCampsiteError(new HttpError("Unauthorized", 401, {}));
		expect(error.status).toBe(401);
		expect(error.message).toContain("đăng nhập lại");
		expect(error.canRetry).toBe(false);
	});

	it("maps 403 forbidden error correctly", () => {
		const error = mapReviewCampsiteError(new HttpError("Forbidden", 403, {}));
		expect(error.status).toBe(403);
		expect(error.message).toContain("Admin");
		expect(error.canRetry).toBe(false);
	});

	it("maps 404 not found error correctly", () => {
		const error = mapReviewCampsiteError(new HttpError("Not Found", 404, {}));
		expect(error.status).toBe(404);
		expect(error.message).toContain("Không tìm thấy");
		expect(error.canRetry).toBe(false);
	});

	it("maps 409 conflict error correctly", () => {
		const error = mapReviewCampsiteError(
			new HttpError("Conflict", 409, { message: "Custom conflict message" })
		);
		expect(error.status).toBe(409);
		expect(error.message).toBe("Custom conflict message");
		expect(error.canRetry).toBe(true);
	});

	it("maps 422 unprocessable entity correctly", () => {
		const error = mapReviewCampsiteError(
			new HttpError("Unprocessable Entity", 422, { message: "Invalid field format" })
		);
		expect(error.status).toBe(422);
		expect(error.message).toBe("Invalid field format");
		expect(error.canRetry).toBe(false);
	});
});
