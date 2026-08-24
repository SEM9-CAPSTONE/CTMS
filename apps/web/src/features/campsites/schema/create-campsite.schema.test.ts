import { describe, expect, it } from "vitest";
import {
	type CreateCampsiteFormValues,
	createCampsiteFormSchema,
	toCreateCampsiteInput,
} from "./create-campsite.schema";

function validForm(): CreateCampsiteFormValues {
	return {
		name: "Da Lat Pine Camp",
		description: "A quiet campsite prepared for trekking stays.",
		latitude: "11.940419",
		longitude: "108.458313",
		province: "Lam Dong",
		placeLabel: "Da Lat Pine Camp, Lam Dong",
		policies: "No campfires after 21:00.",
		opensAt: "08:00",
		closesAt: "18:00",
		initialImages: [
			{
				url: "https://example.com/campsite.jpg",
				sortOrder: "1",
			},
		],
	};
}

describe("createCampsiteFormSchema", () => {
	it("accepts a valid campsite", () => {
		expect(createCampsiteFormSchema.safeParse(validForm()).success).toBe(true);
	});

	it("requires every campsite field", () => {
		const result = createCampsiteFormSchema.safeParse({
			name: "",
			description: "",
			latitude: "",
			longitude: "",
			province: "",
			placeLabel: "",
			policies: "",
			opensAt: "",
			closesAt: "",
			initialImages: [],
		});

		expect(result.success).toBe(false);

		if (!result.success) {
			const paths = result.error.issues.map((issue) => issue.path[0]);

			expect(paths).toContain("name");
			expect(paths).toContain("description");
			expect(paths).toContain("latitude");
			expect(paths).toContain("longitude");
			expect(paths).toContain("province");
			expect(paths).toContain("placeLabel");
			expect(paths).toContain("policies");
			expect(paths).toContain("opensAt");
			expect(paths).toContain("closesAt");
			expect(paths).toContain("initialImages");
		}
	});

	it("rejects coordinates outside the backend range", () => {
		const latitude = validForm();
		latitude.latitude = "91";

		const longitude = validForm();
		longitude.longitude = "-181";

		expect(createCampsiteFormSchema.safeParse(latitude).success).toBe(false);
		expect(createCampsiteFormSchema.safeParse(longitude).success).toBe(false);
	});

	it("rejects coordinates with more than 6 decimal places", () => {
		const form = validForm();
		form.latitude = "11.1234567";

		expect(createCampsiteFormSchema.safeParse(form).success).toBe(false);
	});

	it("requires opensAt to be earlier than closesAt", () => {
		const form = validForm();
		form.opensAt = "18:00";
		form.closesAt = "08:00";

		expect(createCampsiteFormSchema.safeParse(form).success).toBe(false);
	});

	it("requires an HTTP/HTTPS image URL", () => {
		const form = validForm();
		form.initialImages[0].url = "ftp://example.com/image.jpg";

		expect(createCampsiteFormSchema.safeParse(form).success).toBe(false);
	});

	it("rejects duplicate image display orders", () => {
		const form = validForm();

		form.initialImages = [
			{
				url: "https://example.com/1.jpg",
				sortOrder: "1",
			},
			{
				url: "https://example.com/2.jpg",
				sortOrder: "1",
			},
		];

		expect(createCampsiteFormSchema.safeParse(form).success).toBe(false);
	});

	it("maps UI values to the exact backend contract", () => {
		expect(toCreateCampsiteInput(validForm())).toEqual({
			name: "Da Lat Pine Camp",
			description: "A quiet campsite prepared for trekking stays.",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lam Dong",
			policies: { rules: "No campfires after 21:00." },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{
					url: "https://example.com/campsite.jpg",
					type: "photo",
					sortOrder: 1,
				},
			],
		});
	});
});
