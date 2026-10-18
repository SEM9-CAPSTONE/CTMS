import {
	PORTER_CONFLICT_ASSIGNMENT_TRIP,
	PORTER_CONFLICT_TARGET_TRIP,
	PORTER_CONFLICT_TRIP_TITLE,
	PORTER_NON_CONFLICT_TARGET_TRIP,
	PORTER_SEED_FIXTURES,
	PORTER_SEED_ROUTE_NAMES,
	porterSeedTripWindowsOverlap,
} from "./porter.seed-fixtures";

describe("PORTER_SEED_FIXTURES", () => {
	it("uses unique deterministic account identifiers and valid profile values", () => {
		expect(new Set(PORTER_SEED_FIXTURES.map((fixture) => fixture.key)).size).toBe(
			PORTER_SEED_FIXTURES.length
		);
		expect(new Set(PORTER_SEED_FIXTURES.map((fixture) => fixture.email)).size).toBe(
			PORTER_SEED_FIXTURES.length
		);
		expect(new Set(PORTER_SEED_FIXTURES.map((fixture) => fixture.phone)).size).toBe(
			PORTER_SEED_FIXTURES.length
		);

		for (const fixture of PORTER_SEED_FIXTURES) {
			if (!fixture.profile) continue;
			expect(fixture.profile.experienceYears).toBeGreaterThanOrEqual(0);
			expect(fixture.profile.completedTrips).toBeGreaterThanOrEqual(0);
			expect(fixture.profile.ratingAvg).toBeGreaterThanOrEqual(0);
			expect(fixture.profile.ratingAvg).toBeLessThanOrEqual(5);
		}
	});

	it("covers eligibility, qualification, availability, account, profile, and conflict scenarios", () => {
		expect(
			PORTER_SEED_FIXTURES.some(
				(fixture) =>
					fixture.userStatus === "active" &&
					fixture.profile?.availabilityStatus === "available" &&
					fixture.qualification?.proficiency === "expert"
			)
		).toBe(true);
		expect(
			PORTER_SEED_FIXTURES.some((fixture) => fixture.qualification?.proficiency === "proficient")
		).toBe(true);
		expect(
			PORTER_SEED_FIXTURES.some((fixture) => fixture.qualification?.proficiency === "learning")
		).toBe(true);
		expect(
			PORTER_SEED_FIXTURES.some((fixture) => fixture.profile?.availabilityStatus === "unavailable")
		).toBe(true);
		expect(PORTER_SEED_FIXTURES.some((fixture) => fixture.userStatus === "suspended")).toBe(true);
		expect(PORTER_SEED_FIXTURES.some((fixture) => fixture.profile === null)).toBe(true);
		expect(
			PORTER_SEED_FIXTURES.some(
				(fixture) => fixture.conflictingTripTitle === PORTER_CONFLICT_TRIP_TITLE
			)
		).toBe(true);
	});

	it("keeps learning out of lead eligibility while providing multiple verified lead fixtures", () => {
		const leadEligible = PORTER_SEED_FIXTURES.filter(
			(fixture) =>
				fixture.userStatus === "active" &&
				fixture.profile?.availabilityStatus === "available" &&
				(fixture.qualification?.proficiency === "proficient" ||
					fixture.qualification?.proficiency === "expert")
		);
		const learning = PORTER_SEED_FIXTURES.find(
			(fixture) => fixture.qualification?.proficiency === "learning"
		);

		expect(leadEligible.length).toBeGreaterThanOrEqual(3);
		expect(learning?.key).toBe("learning-support");
		expect(learning?.qualification?.timesLed).toBe(0);
	});

	it("references only canonical seeded Routes", () => {
		const routeNames = new Set(PORTER_SEED_ROUTE_NAMES);
		for (const fixture of PORTER_SEED_FIXTURES) {
			for (const routeName of fixture.qualification?.routeNames ?? []) {
				expect(routeNames.has(routeName)).toBe(true);
			}
		}
	});

	it("uses a distinct assigned Trip whose schedule overlaps the searchable target", () => {
		expect(PORTER_CONFLICT_ASSIGNMENT_TRIP.title).not.toBe(PORTER_CONFLICT_TARGET_TRIP.title);
		expect(
			porterSeedTripWindowsOverlap(
				PORTER_CONFLICT_ASSIGNMENT_TRIP.window,
				PORTER_CONFLICT_TARGET_TRIP.window
			)
		).toBe(true);
	});

	it("keeps the conflict Porter eligible for a non-overlapping Trip window", () => {
		expect(
			porterSeedTripWindowsOverlap(
				PORTER_CONFLICT_ASSIGNMENT_TRIP.window,
				PORTER_NON_CONFLICT_TARGET_TRIP.window
			)
		).toBe(false);
	});
});
