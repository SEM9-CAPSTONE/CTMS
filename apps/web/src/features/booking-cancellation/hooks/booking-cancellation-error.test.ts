import { expect, it } from "vitest";
import { HttpError } from "../../../core/api";
import { mapBookingCancellationError } from "./booking-cancellation-error";

it.each([
	[401, "unauthenticated"],
	[403, "forbidden"],
	[404, "not_found"],
	[409, "conflict"],
	[422, "validation"],
	[500, "uncertain"],
	[503, "uncertain"],
	[400, "unexpected"],
])("maps HTTP %s to %s", (status, kind) => {
	expect(
		mapBookingCancellationError(new HttpError("raw provider failure", Number(status), {})).kind
	).toBe(kind);
});
it("maps network errors as uncertain and does not expose raw internals", () => {
	expect(mapBookingCancellationError(new Error("secret"))).toMatchObject({ kind: "uncertain" });
	expect(mapBookingCancellationError(new HttpError("secret", 500, {})).message).not.toContain(
		"secret"
	);
});
it("extracts structured reason errors and tolerates malformed data", () => {
	expect(
		mapBookingCancellationError(
			new HttpError("bad", 422, { message: [{ field: "reason", errors: ["too long"] }] })
		).reasonError
	).toBe("too long");
	expect(
		mapBookingCancellationError(
			new HttpError("bad", 422, { message: [null, "bad", { field: "reason", errors: 12 }] })
		).reasonError
	).toBeUndefined();
});
