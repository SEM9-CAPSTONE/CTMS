import type { DataSource } from "typeorm";
import dataSource from "../shared/database/data-source";
import { readableDemoTripTitle, tidyDemoCopyForReview } from "./main.seed";
import {
	DA_NANG_SEED_ROUTE_UPDATES,
	DA_NANG_TRIP_MOVES,
	PORTER_CONFLICT_ASSIGNMENT_TRIP,
	PORTER_CONFLICT_TARGET_TRIP,
	PORTER_CONFLICT_TRIP_TITLE,
	PORTER_LEVEL_DEMO_COPY,
	PORTER_NON_CONFLICT_TARGET_TRIP,
	PORTER_SEED_FIXTURES,
	PORTER_SEED_ROUTE_NAMES,
	porterSeedTripWindowsOverlap,
	refreshDaNangSeedData,
	refreshPorterLevelDemoCopy,
	rewriteDaNangSeedCopy,
	runMasterSeed,
} from "./main.seed";

describe("Master seed entry point", () => {
	it.each([
		"--da-nang-only",
		"--financial-adjustments-only",
		"--bank-accounts-only",
		"--group-bookings-only",
		"--revenue-analytics-only",
		"--safety-hotspots-only",
		"--fresh",
	])("refuses %s in production before connecting to the database", async (flag) => {
		const environment = jest.replaceProperty(process, "env", {
			...process.env,
			NODE_ENV: "production",
		});
		const argv = jest.replaceProperty(process, "argv", ["node", "main.seed.ts", flag]);
		const initialize = jest.spyOn(dataSource, "initialize");
		try {
			await expect(runMasterSeed()).rejects.toThrow("production");
			expect(initialize).not.toHaveBeenCalled();
		} finally {
			initialize.mockRestore();
			argv.restore();
			environment.restore();
		}
	});

	it("closes the database when a financial-only seed fails without prerequisite accounts", async () => {
		const environment = jest.replaceProperty(process, "env", {
			...process.env,
			NODE_ENV: "test",
		});
		const argv = jest.replaceProperty(process, "argv", [
			"node",
			"main.seed.ts",
			"--financial-adjustments-only",
		]);
		const initialized = jest.replaceProperty(dataSource, "isInitialized", true);
		const query = jest.spyOn(dataSource, "query").mockResolvedValue([]);
		const destroy = jest.spyOn(dataSource, "destroy").mockResolvedValue();
		try {
			await expect(runMasterSeed()).rejects.toThrow("admin, host và camper");
			expect(query).toHaveBeenCalledTimes(1);
			expect(destroy).toHaveBeenCalledTimes(1);
		} finally {
			destroy.mockRestore();
			query.mockRestore();
			initialized.restore();
			argv.restore();
			environment.restore();
		}
	});
});

describe("Da Nang seed maintenance", () => {
	it("moves known northern trip copy while preserving appended notes", () => {
		expect(rewriteDaNangSeedCopy("Săn mây Y Tý - Bát Xát (Lào Cai)")).toBe(
			"Săn mây đỉnh Núi Chúa – Hòa Vang"
		);
		expect(
			rewriteDaNangSeedCopy(
				"Cung đường ruộng bậc thang và biển mây ngút ngàn Lào Cai.\nKhách đã báo sẽ đến điểm hẹn lúc 6 giờ."
			)
		).toBe(
			"Đi bộ xuyên rừng Bà Nà, nghỉ qua đêm trên sườn Núi Chúa và đón biển mây trong ánh bình minh.\nKhách đã báo sẽ đến điểm hẹn lúc 6 giờ."
		);
		expect(rewriteDaNangSeedCopy("Khách đã báo sẽ đến điểm hẹn lúc 6 giờ.")).toBe(
			"Khách đã báo sẽ đến điểm hẹn lúc 6 giờ."
		);
	});

	it("keeps replacement route coordinates around Da Nang and names free of scenario tags", () => {
		for (const route of DA_NANG_SEED_ROUTE_UPDATES) {
			for (const point of route.path.split(",")) {
				const [lng, lat] = point.trim().split(/\s+/).map(Number);
				expect(lng).toBeGreaterThanOrEqual(107.7);
				expect(lng).toBeLessThanOrEqual(108.5);
				expect(lat).toBeGreaterThanOrEqual(15.8);
				expect(lat).toBeLessThanOrEqual(16.4);
			}
		}
		for (const move of DA_NANG_TRIP_MOVES)
			expect(move.title).not.toMatch(/CTMS|demo|Fansipan|Y Tý|Mù Cang|Lào Cai|Yên Bái/i);
	});

	it("repairs existing copy without changing keys, financial values or statuses", async () => {
		const query = jest.fn().mockImplementation(async (sql: string) => {
			if (sql.startsWith("SELECT t.id,t.title,t.description,t.itinerary"))
				return [
					{
						id: "trip-existing",
						title: "Săn mây Y Tý - Bát Xát (Lào Cai)",
						description: "Khách sẽ đến điểm hẹn lúc 6 giờ.",
						itinerary: { summary: "Nghỉ tại điểm hẹn trước giờ khởi hành." },
					},
				];
			return [];
		});
		const transaction = async (work: (manager: { query: typeof query }) => Promise<unknown>) =>
			work({ query });
		const result = await refreshDaNangSeedData({
			isInitialized: true,
			transaction,
		} as unknown as DataSource);
		expect(result).toEqual({ tripsUpdated: 1, routesUpdated: 0, areasUpdated: 0 });
		const update = query.mock.calls.find(([sql]) => sql.startsWith("UPDATE trips SET title="));
		expect(update?.[1]).toEqual([
			"trip-existing",
			"Săn mây đỉnh Núi Chúa – Hòa Vang",
			"Khách sẽ đến điểm hẹn lúc 6 giờ.",
			JSON.stringify({ summary: "Nghỉ tại điểm hẹn trước giờ khởi hành." }),
		]);
		for (const [sql] of query.mock.calls) {
			expect(sql).not.toMatch(/\b(?:INSERT|DELETE|TRUNCATE)\b/i);
			expect(sql).not.toMatch(
				/\bSET\s+(?:id|status|balance|amount|price_per_person|route_id|host_id)\s*=/i
			);
		}
	});

	it("does not rewrite records whose copy is already localized", async () => {
		const query = jest.fn().mockImplementation(async (sql: string) =>
			sql.startsWith("SELECT t.id,t.title,t.description,t.itinerary")
				? [
						{
							id: "trip-existing",
							title: "Săn mây đỉnh Núi Chúa – Hòa Vang",
							description: "Khách sẽ đến điểm hẹn lúc 6 giờ.",
							itinerary: null,
						},
					]
				: []
		);
		const transaction = async (work: (manager: { query: typeof query }) => Promise<unknown>) =>
			work({ query });
		expect(
			await refreshDaNangSeedData({ isInitialized: true, transaction } as unknown as DataSource)
		).toEqual({
			tripsUpdated: 0,
			routesUpdated: 0,
			areasUpdated: 0,
		});
		expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE trips SET title="))).toBe(false);
	});
});

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
