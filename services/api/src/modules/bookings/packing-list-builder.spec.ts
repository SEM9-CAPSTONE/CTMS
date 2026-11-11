import { TrekkingRouteDifficulty } from "../trekking-routes/entities/trekking-route.entity";
import { RiskLevel } from "../weather/entities/weather-risk-assessment.entity";
import {
	type HealthProfileInput,
	type PackingListContext,
	type RentedEquipmentInput,
	buildPackingListItems,
} from "./packing-list-builder";

function baseContext(overrides: Partial<PackingListContext> = {}): PackingListContext {
	return {
		durationNights: 0,
		tripType: "day_trip",
		difficulty: null,
		memberCount: 1,
		weatherRiskLevel: null,
		weatherCriteria: null,
		...overrides,
	};
}

function criterion(level: RiskLevel, value: number | boolean = 0) {
	return { value, level, weight: 0.2, score: level === RiskLevel.GREEN ? 0 : 1 };
}

function greenWeather() {
	return {
		rainfall: criterion(RiskLevel.GREEN),
		wind: criterion(RiskLevel.GREEN),
		temperature: criterion(RiskLevel.GREEN),
		visibility: criterion(RiskLevel.GREEN),
		thunderstorm: criterion(RiskLevel.GREEN, false),
	};
}

function findItem(items: ReturnType<typeof buildPackingListItems>, id: string) {
	return items.find((item) => item.id === id);
}

describe("buildPackingListItems", () => {
	it("always includes the base essential items for a day trip", () => {
		const items = buildPackingListItems(baseContext(), [], null);

		expect(findItem(items, "id-documents")).toMatchObject({ required: true });
		expect(findItem(items, "drinking-water")).toMatchObject({ required: true });
		expect(findItem(items, "headlamp")).toMatchObject({ required: true });
		expect(findItem(items, "first-aid-kit")).toMatchObject({ required: true });
		expect(findItem(items, "sleeping-bag")).toBeUndefined();
		expect(findItem(items, "tent")).toBeUndefined();
	});

	it("scales the drinking-water reason to the member count", () => {
		const items = buildPackingListItems(baseContext({ memberCount: 4 }), [], null);
		expect(findItem(items, "drinking-water")?.reason).toContain("4 người");
	});

	it("adds overnight items, required, when the trip has nights", () => {
		const items = buildPackingListItems(
			baseContext({ tripType: "overnight", durationNights: 2 }),
			[],
			null
		);

		expect(findItem(items, "sleeping-bag")).toMatchObject({
			required: true,
			alreadyCovered: false,
		});
		expect(findItem(items, "tent")).toMatchObject({ required: true, alreadyCovered: false });
		expect(findItem(items, "warm-night-clothing")).toMatchObject({ required: true });
	});

	it.each([
		["shelter", "tent"],
		["sleeping gear", "sleeping-bag"],
	])(
		"marks the overnight item already covered when rented equipment category matches %s",
		(category, itemId) => {
			const rented: RentedEquipmentInput[] = [{ name: "Gear", category, quantity: 1 }];
			const items = buildPackingListItems(
				baseContext({ tripType: "overnight", durationNights: 1 }),
				rented,
				null
			);

			expect(findItem(items, itemId)).toMatchObject({ required: false, alreadyCovered: true });
		}
	);

	it.each([
		[TrekkingRouteDifficulty.EASY, false, false],
		[TrekkingRouteDifficulty.MODERATE, true, false],
		[TrekkingRouteDifficulty.HARD, true, true],
		[TrekkingRouteDifficulty.EXPERT, true, true],
	])("difficulty %s -> trekking poles %s, boots %s", (difficulty, expectPoles, expectBoots) => {
		const items = buildPackingListItems(baseContext({ difficulty }), [], null);

		expect(Boolean(findItem(items, "trekking-poles"))).toBe(expectPoles);
		expect(Boolean(findItem(items, "trekking-boots"))).toBe(expectBoots);
		if (expectPoles) expect(findItem(items, "trekking-poles")?.required).toBe(false);
		if (expectBoots) expect(findItem(items, "trekking-boots")?.required).toBe(true);
	});

	it("adds no weather-based items when no assessment is available", () => {
		const items = buildPackingListItems(baseContext(), [], null);
		expect(findItem(items, "rain-gear")).toBeUndefined();
		expect(findItem(items, "windbreaker")).toBeUndefined();
		expect(findItem(items, "extra-light-source")).toBeUndefined();
		expect(findItem(items, "lightning-safety-note")).toBeUndefined();
	});

	it("adds no weather-based items when every criterion is green", () => {
		const items = buildPackingListItems(
			baseContext({ weatherRiskLevel: RiskLevel.GREEN, weatherCriteria: greenWeather() }),
			[],
			null
		);
		expect(findItem(items, "rain-gear")).toBeUndefined();
		expect(findItem(items, "windbreaker")).toBeUndefined();
		expect(findItem(items, "extra-light-source")).toBeUndefined();
		expect(findItem(items, "lightning-safety-note")).toBeUndefined();
	});

	it("adds rain gear, windbreaker, and extra light source for non-green criteria", () => {
		const criteria = greenWeather();
		criteria.rainfall = criterion(RiskLevel.RED);
		criteria.wind = criterion(RiskLevel.YELLOW);
		criteria.visibility = criterion(RiskLevel.YELLOW);
		const items = buildPackingListItems(baseContext({ weatherCriteria: criteria }), [], null);

		expect(findItem(items, "rain-gear")).toMatchObject({ required: true });
		expect(findItem(items, "windbreaker")).toMatchObject({ required: true });
		expect(findItem(items, "extra-light-source")).toMatchObject({ required: false });
	});

	it("adds the lightning safety note only when thunderstorm is true", () => {
		const criteria = greenWeather();
		criteria.thunderstorm = criterion(RiskLevel.RED, true);
		const items = buildPackingListItems(baseContext({ weatherCriteria: criteria }), [], null);

		expect(findItem(items, "lightning-safety-note")).toMatchObject({ required: false });
	});

	it("adds no health items when the Camper has not granted consent, even with data present", () => {
		const health: HealthProfileInput = {
			isConsentGranted: false,
			allergies: [{ id: "a1", name: "Peanuts", severity: "HIGH" }],
			medicalConditions: [{ id: "m1", name: "Asthma" }],
			dietaryRestrictions: "No seafood",
		};
		const items = buildPackingListItems(baseContext(), [], health);

		expect(findItem(items, "allergy-medication")).toBeUndefined();
		expect(findItem(items, "medical-condition-medication")).toBeUndefined();
		expect(findItem(items, "dietary-note")).toBeUndefined();
	});

	it("adds health items only when consent is granted and the relevant data is present", () => {
		const health: HealthProfileInput = {
			isConsentGranted: true,
			allergies: [{ id: "a1", name: "Peanuts", severity: "HIGH" }],
			medicalConditions: [],
			dietaryRestrictions: "  ",
		};
		const items = buildPackingListItems(baseContext(), [], health);

		expect(findItem(items, "allergy-medication")).toMatchObject({ required: true });
		expect(findItem(items, "medical-condition-medication")).toBeUndefined();
		expect(findItem(items, "dietary-note")).toBeUndefined();
	});

	it("lists rented equipment as already covered, informational items", () => {
		const rented: RentedEquipmentInput[] = [
			{ name: "4-person tent", category: "shelter", quantity: 2 },
		];
		const items = buildPackingListItems(baseContext(), rented, null);

		const rentedItem = findItem(items, "rented-4-person-tent");
		expect(rentedItem).toMatchObject({ required: false, alreadyCovered: true });
		expect(rentedItem?.name).toContain("x2");
	});

	it("is deterministic: same inputs produce an identical ordered result", () => {
		const context = baseContext({
			tripType: "overnight",
			durationNights: 1,
			difficulty: TrekkingRouteDifficulty.HARD,
			weatherCriteria: greenWeather(),
		});
		const rented: RentedEquipmentInput[] = [{ name: "Tent", category: "shelter", quantity: 1 }];
		const health: HealthProfileInput = {
			isConsentGranted: true,
			allergies: [],
			medicalConditions: [],
			dietaryRestrictions: null,
		};

		const first = buildPackingListItems(context, rented, health);
		const second = buildPackingListItems(context, rented, health);

		expect(second).toEqual(first);
	});
});
