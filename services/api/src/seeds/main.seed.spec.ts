import type { DataSource } from "typeorm";
import { readableDemoTripTitle, tidyDemoCopyForReview } from "./main.seed";
import {
	PORTER_CONFLICT_ASSIGNMENT_TRIP,
	PORTER_CONFLICT_TARGET_TRIP,
	PORTER_CONFLICT_TRIP_TITLE,
	PORTER_LEVEL_DEMO_COPY,
	PORTER_NON_CONFLICT_TARGET_TRIP,
	PORTER_SEED_FIXTURES,
	PORTER_SEED_ROUTE_NAMES,
	porterSeedTripWindowsOverlap,
	refreshPorterLevelDemoCopy,
} from "./main.seed";

describe("Porter demo copy maintenance", () => {
	it("refuses production before opening a transaction", async () => {
		const previous = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";
		const transaction = jest.fn();
		try {
			await expect(
				refreshPorterLevelDemoCopy({ transaction } as unknown as DataSource)
			).rejects.toThrow("production");
			expect(transaction).not.toHaveBeenCalled();
		} finally {
			process.env.NODE_ENV = previous;
		}
	});
	it("skips untouched-copy updates when no exact demo row matches", async () => {
		const query = jest.fn().mockResolvedValue([]);
		const transaction = async (work: (manager: { query: typeof query }) => Promise<unknown>) =>
			work({ query });
		expect(await refreshPorterLevelDemoCopy({ transaction } as unknown as DataSource)).toEqual({
			requestsUpdated: 0,
			policiesUpdated: 0,
		});
		expect(query).toHaveBeenCalledTimes(4);
		const requestSql = query.mock.calls[0][0] as string;
		expect(requestSql).toContain("r.version=$6");
		expect(requestSql).toContain("porter_level_decisions");
		expect(requestSql).toContain("porter_level_request_evidence");
		expect(query.mock.calls[0][1][0]).toBe("c1380000-0000-4000-8000-000000000001");
		expect(PORTER_LEVEL_DEMO_COPY.reason).not.toMatch(/DEMO|CTMS-|pending|người test/);
	});
});

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

describe("Readable demo copy", () => {
	it("removes only recognized demo tags and leaves a real title untouched", () => {
		expect(readableDemoTripTitle("[DEMO CTMS-306] Sơn Trà - Xem dữ liệu ngoại tuyến")).toBe(
			"Sơn Trà – Hành trình ven biển"
		);
		expect(readableDemoTripTitle("[CTMS-024] Khám Phá Sơn Trà (Bình thường - Còn 12 chỗ)")).toBe(
			"Khám Phá Sơn Trà"
		);
		expect(readableDemoTripTitle("Chuyến Sơn Trà")).toBe("Chuyến Sơn Trà");
	});
	it("refuses cleanup without the opt-in flag", async () => {
		const environment = jest.replaceProperty(process, "env", {
			...process.env,
			CTMS138_DEMO_SEED: "",
		});
		const transaction = jest.fn();
		try {
			await expect(tidyDemoCopyForReview({ transaction } as unknown as DataSource)).rejects.toThrow(
				"CTMS138_DEMO_SEED"
			);
			expect(transaction).not.toHaveBeenCalled();
		} finally {
			environment.restore();
		}
	});
});
