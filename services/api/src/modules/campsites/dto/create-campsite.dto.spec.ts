import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCampsiteDto } from "./create-campsite.dto";

function validPayload(overrides: Partial<CreateCampsiteDto> = {}) {
	return {
		name: "Hai Van Camp",
		description: "Mountain and sea campsite",
		latitude: 16.1348,
		longitude: 108.114855,
		province: "Da Nang",
		policies: { rules: "No campfires after 21:00" },
		operatingHours: { opensAt: "06:00", closesAt: "20:00" },
		media: [
			{
				url: "http://localhost:3000/uploads/campsites/hai-van.jpg",
				type: "photo",
				sortOrder: 0,
			},
		],
		...overrides,
	};
}

describe("CreateCampsiteDto", () => {
	it("accepts localhost upload URLs returned by the local media endpoint", async () => {
		const dto = plainToInstance(CreateCampsiteDto, validPayload());

		const errors = await validate(dto, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		expect(errors).toEqual([]);
	});
});
