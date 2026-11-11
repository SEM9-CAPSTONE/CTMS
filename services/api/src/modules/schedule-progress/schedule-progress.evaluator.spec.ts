import { GUIDANCE } from "./schedule-progress.constants";
import {
	BehindScheduleLevel,
	type CamperFacts,
	type LastValidSample,
	type RouteCheckpoint,
	ScheduleStatus,
	evaluateCamper,
	isSafeCheckpoint,
} from "./schedule-progress.evaluator";

const T_X = new Date("2026-11-07T03:00:00.000Z");
const minutesAfter = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);

function checkpoint(overrides: Partial<RouteCheckpoint> & { id: string }): RouteCheckpoint {
	return {
		name: overrides.id,
		type: "dangerous",
		nearbyWaterOrShelter: false,
		routeFraction: 0.5,
		latitude: 16.05,
		longitude: 108.2,
		...overrides,
	};
}

const START = checkpoint({
	id: "start",
	type: "start",
	routeFraction: 0,
	latitude: 16.0,
	longitude: 108.2,
});
const PASS = checkpoint({
	id: "pass",
	type: "dangerous",
	routeFraction: 0.3,
	latitude: 16.03,
	longitude: 108.2,
});
const REST = checkpoint({
	id: "rest",
	name: "Trạm nghỉ",
	type: "rest",
	routeFraction: 0.5,
	latitude: 16.05,
	longitude: 108.2,
});
const FINISH = checkpoint({
	id: "finish",
	name: "Đích",
	type: "finish",
	routeFraction: 1,
	latitude: 16.1,
	longitude: 108.2,
});
const CHECKPOINTS = [FINISH, REST, PASS, START];

function sample(overrides: Partial<LastValidSample> = {}): LastValidSample {
	return {
		eventTime: minutesAfter(T_X, 30),
		latitude: 16.025,
		longitude: 108.2,
		accuracyMeters: 8,
		routeFraction: 0.25,
		...overrides,
	};
}

function camper(overrides: Partial<CamperFacts> = {}): CamperFacts {
	return {
		userId: "camper-1",
		passedCheckpointIds: new Set(["start"]),
		lastValidSample: sample(),
		...overrides,
	};
}

function evaluate(
	minutes: number,
	overrides: Partial<CamperFacts> = {},
	baselines: Array<[string, Date]> = [
		["start", minutesAfter(T_X, -60)],
		["pass", T_X],
	],
	checkpoints: RouteCheckpoint[] = CHECKPOINTS
) {
	const now = minutesAfter(T_X, minutes);
	const facts = camper({
		lastValidSample: sample({ eventTime: minutesAfter(now, -1) }),
		...overrides,
	});
	return evaluateCamper({ camper: facts, checkpoints, porterBaselines: new Map(baselines), now });
}

describe("evaluateCamper (CTMS-063 §13, BR-241)", () => {
	it("is ON_TRACK when the Camper's own GPS proves they passed every Porter-confirmed Checkpoint", () => {
		const result = evaluate(90, { passedCheckpointIds: new Set(["start", "pass"]) });

		expect(result.status).toBe(ScheduleStatus.ON_TRACK);
		expect(result.reference).toBeNull();
		expect(result.levelsReached).toEqual([]);
	});

	it("is ON_TRACK with nothing to evaluate before any Porter confirmation", () => {
		const result = evaluate(90, { passedCheckpointIds: new Set() }, []);

		expect(result.status).toBe(ScheduleStatus.ON_TRACK);
		expect(result.reference).toBeNull();
	});

	it("stays ON_TRACK at 29 minutes behind the Porter (boundary)", () => {
		const result = evaluate(29);

		expect(result.status).toBe(ScheduleStatus.ON_TRACK);
		expect(result.reference?.checkpointId).toBe("pass");
		expect(result.lagMinutes).toBe(29);
		expect(result.guidance).toBeNull();
		expect(result.levelsReached).toEqual([]);
	});

	it("raises BEHIND at 30 minutes with the nearest safe Checkpoint ahead and the policy text", () => {
		const result = evaluate(30);

		expect(result.status).toBe(ScheduleStatus.BEHIND);
		expect(result.lagMinutes).toBe(30);
		expect(result.safeCheckpoint).toEqual({ id: "rest", name: "Trạm nghỉ", type: "rest" });
		expect(result.guidance).toBe(GUIDANCE.behind(30, "pass", "Trạm nghỉ"));
		expect(result.levelsReached).toEqual([BehindScheduleLevel.BEHIND]);
	});

	it("raises SEVERELY_BEHIND at 60 minutes with the nearest safe Checkpoint in either direction", () => {
		const nearStart = checkpoint({
			id: "shelter",
			name: "Lều trú",
			type: "emergency_shelter",
			routeFraction: 0.1,
			latitude: 16.024,
			longitude: 108.2,
		});
		const result = evaluate(60, {}, undefined, [...CHECKPOINTS, nearStart]);

		expect(result.status).toBe(ScheduleStatus.SEVERELY_BEHIND);
		expect(result.safeCheckpoint?.id).toBe("shelter");
		expect(result.guidance).toBe(GUIDANCE.severelyBehind("Lều trú"));
		expect(result.levelsReached).toEqual([
			BehindScheduleLevel.BEHIND,
			BehindScheduleLevel.SEVERELY_BEHIND,
		]);
	});

	it("reports LOCATION_UNKNOWN, never behind, when the last VALID sample is older than 5 minutes", () => {
		const now = minutesAfter(T_X, 60);
		const result = evaluate(60, { lastValidSample: sample({ eventTime: minutesAfter(now, -6) }) });

		expect(result.status).toBe(ScheduleStatus.LOCATION_UNKNOWN);
		expect(result.lagMinutes).toBeNull();
		expect(result.guidance).toBe(GUIDANCE.locationUnknown);
		expect(result.levelsReached).toEqual([]);
	});

	it("reports LOCATION_UNKNOWN when the Camper has no VALID sample at all", () => {
		const result = evaluate(60, { lastValidSample: null });

		expect(result.status).toBe(ScheduleStatus.LOCATION_UNKNOWN);
		expect(result.lastValidSampleAt).toBeNull();
	});

	it("accepts a sample exactly 5 minutes old as a known location (boundary)", () => {
		const now = minutesAfter(T_X, 30);
		const result = evaluate(30, { lastValidSample: sample({ eventTime: minutesAfter(now, -5) }) });

		expect(result.status).toBe(ScheduleStatus.BEHIND);
	});

	it("uses the fallback text and never invents a Checkpoint when no safe Checkpoint exists", () => {
		const unsafe = [
			START,
			PASS,
			checkpoint({ id: "ridge", type: "dangerous", routeFraction: 0.8 }),
		];
		const behind = evaluate(30, {}, undefined, unsafe);
		const severe = evaluate(60, {}, undefined, unsafe);

		expect(behind.safeCheckpoint).toBeNull();
		expect(behind.guidance).toBe(GUIDANCE.noSafeCheckpoint);
		expect(severe.safeCheckpoint).toBeNull();
		expect(severe.guidance).toBe(GUIDANCE.noSafeCheckpoint);
	});

	it("evaluates the earliest Porter-confirmed Checkpoint along the Route that the Camper has not passed", () => {
		const result = evaluate(45, { passedCheckpointIds: new Set() }, [
			["pass", T_X],
			["start", minutesAfter(T_X, -60)],
		]);

		expect(result.reference?.checkpointId).toBe("start");
		expect(result.lagMinutes).toBe(105);
		expect(result.status).toBe(ScheduleStatus.SEVERELY_BEHIND);
	});

	it("moves on to the next Porter-confirmed Checkpoint once the Camper passes the previous one", () => {
		const result = evaluate(20, { passedCheckpointIds: new Set(["start", "pass"]) }, [
			["start", minutesAfter(T_X, -60)],
			["pass", minutesAfter(T_X, -40)],
			["rest", T_X],
		]);

		expect(result.reference?.checkpointId).toBe("rest");
		expect(result.status).toBe(ScheduleStatus.ON_TRACK);
	});

	it("starts 'ahead' at the reference Checkpoint when the Camper is outside the on-route corridor", () => {
		const result = evaluate(30, { lastValidSample: null }, undefined, CHECKPOINTS);
		expect(result.status).toBe(ScheduleStatus.LOCATION_UNKNOWN);

		const offCorridor = evaluate(30, {
			lastValidSample: sample({ eventTime: minutesAfter(T_X, 29), routeFraction: null }),
		});
		expect(offCorridor.safeCheckpoint?.id).toBe("rest");
	});

	it("treats rest, water, emergency_shelter, finish and nearby-water-or-shelter Checkpoints as safe", () => {
		for (const type of ["rest", "water", "emergency_shelter", "finish"]) {
			expect(isSafeCheckpoint(checkpoint({ id: type, type }))).toBe(true);
		}
		expect(isSafeCheckpoint(checkpoint({ id: "d", type: "dangerous" }))).toBe(false);
		expect(isSafeCheckpoint(checkpoint({ id: "s", type: "start" }))).toBe(false);
		expect(
			isSafeCheckpoint(checkpoint({ id: "n", type: "dangerous", nearbyWaterOrShelter: true }))
		).toBe(true);
	});
});
