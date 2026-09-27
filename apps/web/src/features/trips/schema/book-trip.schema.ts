import { z } from "zod";

const requiredNumber = z.preprocess(
	(value) => {
		if (typeof value === "string") {
			const normalized = value.trim();
			return normalized === "" ? undefined : Number(normalized);
		}
		return value;
	},
	z
		.number({
			required_error: "Số lượng khách là bắt buộc",
			invalid_type_error: "Số lượng khách phải là một số",
		})
		.int("Số lượng khách phải là số nguyên")
		.min(1, "Số lượng khách phải ít nhất là 1")
);

export const bookTripSchema = z.object({
	numPeople: requiredNumber,
});

export type BookTripValues = z.infer<typeof bookTripSchema>;
