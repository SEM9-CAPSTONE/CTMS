import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
	arrivalFingerprint,
	arrivalIntegrityRejection,
	distanceMeters,
} from "./checkpoint-arrival-integrity";
import {
	type CheckpointArrivalInputDto,
	SyncAutomaticCheckpointArrivalsDto,
} from "./checkpoint-arrivals.dto";
import {
	type CheckpointArrivalContext,
	CheckpointArrivalRejection as Reason,
} from "./checkpoint-arrivals.types";

const context: CheckpointArrivalContext = {
	tripId: "11111111-1111-4111-8111-111111111111",
	routeId: "22222222-2222-4222-8222-222222222222",
	routeVersion: "route-v1",
	packageId: "33333333-3333-4333-8333-333333333333",
	packageVersion: "package-v1",
	checkpoints: [{ id: "44444444-4444-4444-8444-444444444444", latitude: 0, longitude: 0 }],
};

function event(distances = [18, 19, 20]): CheckpointArrivalInputDto {
	return {
		id: "55555555-5555-4555-8555-555555555555",
		checkpointId: context.checkpoints[0].id,
		routeId: context.routeId,
		routeVersion: context.routeVersion,
		packageId: context.packageId,
		packageVersion: context.packageVersion,
		detectedOffline: true,
		samples: distances.map((distance, index) => ({
			eventTime: `2026-10-26T00:00:0${index}Z`,
			latitude: (distance / 6_371_000) * (180 / Math.PI),
			longitude: 0,
			accuracyMeters: 20,
		})),
	};
}

describe("CTMS-061 checkpoint arrival evidence", () => {
	it("accepts 18m, 19m, 20m and maximum valid accuracy", () => {
		expect(arrivalIntegrityRejection(event(), context)).toBeNull();
	});
	it("validates boundary distances: 19.99m and 20.0m pass, 20.001m fails", () => {
		expect(arrivalIntegrityRejection(event([19.99, 20.0, 19.99]), context)).toBeNull();
		expect(arrivalIntegrityRejection(event([19.99, 20.001, 19.99]), context)).toBe(
			Reason.THRESHOLD_NOT_MET
		);
	});
	it("rejects consecutive samples closer than 1s or farther than 180s", () => {
		const tooClose = event();
		tooClose.samples[1].eventTime = "2026-10-26T00:00:00.500Z"; // 500ms (< 1s)
		expect(arrivalIntegrityRejection(tooClose, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);

		const tooFar = event();
		tooFar.samples[1].eventTime = "2026-10-26T00:03:02Z"; // 182s (> 180s)
		tooFar.samples[2].eventTime = "2026-10-26T00:03:04Z";
		expect(arrivalIntegrityRejection(tooFar, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);
	});
	it("rejects sample sequences spanning more than 10 minutes", () => {
		const tooLong = event();
		tooLong.samples[1].eventTime = "2026-10-26T00:02:00Z";
		tooLong.samples[2].eventTime = "2026-10-26T00:10:05Z"; // > 600s total
		expect(arrivalIntegrityRejection(tooLong, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);
	});
	it("uses actual distance rather than a supplied radius or claimed distance", () => {
		expect(arrivalIntegrityRejection(event([18, 21, 18]), context)).toBe(Reason.THRESHOLD_NOT_MET);
		expect(distanceMeters({ latitude: 0, longitude: 0 }, context.checkpoints[0])).toBe(0);
	});
	it("rejects an invalid GPS sample between otherwise qualifying samples", () => {
		const input = event();
		input.samples[1].accuracyMeters = 20.01;
		expect(arrivalIntegrityRejection(input, context)).toBe(Reason.THRESHOLD_NOT_MET);
	});
	it("rejects only two samples", () => {
		expect(arrivalIntegrityRejection(event([18, 19]), context)).toBe(
			Reason.INVALID_SAMPLE_SEQUENCE
		);
	});
	it.each(["routeId", "routeVersion", "packageId", "packageVersion"] as const)(
		"rejects unrelated %s",
		(key) => {
			const input = event();
			input[key] = "unrelated";
			expect(arrivalIntegrityRejection(input, context)).toBe(Reason.CONTEXT_MISMATCH);
		}
	);
	it("does not treat a custom Trip waypoint as a Route checkpoint", () => {
		const input = event();
		input.checkpointId = "custom-waypoint";
		expect(arrivalIntegrityRejection(input, context)).toBe(Reason.CHECKPOINT_NOT_IN_PACKAGE);
	});
	it.each(["equal", "reversed"])("rejects %s timestamps", (order) => {
		const input = event();
		if (order === "equal") input.samples[1].eventTime = input.samples[0].eventTime;
		else input.samples.reverse();
		expect(arrivalIntegrityRejection(input, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);
	});
	it("rejects non-finite or invalid date string timestamps", () => {
		const invalidDate = event();
		invalidDate.samples[1].eventTime = "not-a-valid-date";
		expect(arrivalIntegrityRejection(invalidDate, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);

		const emptyDate = event();
		emptyDate.samples[0].eventTime = "";
		expect(arrivalIntegrityRejection(emptyDate, context)).toBe(Reason.INVALID_SAMPLE_SEQUENCE);
	});
	it("fingerprints equivalent timestamps equally but detects changed evidence", () => {
		const a = event();
		const b = event();
		b.samples[0].eventTime = "2026-10-26T07:00:00+07:00";
		expect(arrivalFingerprint(a)).toBe(arrivalFingerprint(b));
		b.samples[0].accuracyMeters = 10;
		expect(arrivalFingerprint(a)).not.toBe(arrivalFingerprint(b));
	});
	it.each([
		["checkpointId", "changed-cp"],
		["routeId", "changed-route"],
		["routeVersion", "v2"],
		["packageId", "changed-pkg"],
		["packageVersion", "pkg-v2"],
		["detectedOffline", false],
	] as const)("fingerprint changes when %s is modified", (field, val) => {
		const base = event();
		const modified = { ...event(), [field]: val };
		expect(arrivalFingerprint(base)).not.toBe(arrivalFingerprint(modified));
	});
});

describe("CTMS-061 arrival DTO", () => {
	const check = (input: unknown) =>
		validate(plainToInstance(SyncAutomaticCheckpointArrivalsDto, input), {
			whitelist: true,
			forbidNonWhitelisted: true,
		});
	it("accepts an offline batch", async () => {
		expect(await check({ arrivals: [event()] })).toEqual([]);
	});
	it.each([
		{ arrivals: [] },
		{ arrivals: Array.from({ length: 101 }, () => event()) },
		{ arrivals: [{ ...event(), packageVersion: null }] },
		{ arrivals: [{ ...event(), id: "not-uuid" }] },
		{ arrivals: [{ ...event(), samples: event().samples.slice(0, 2) }] },
		{ arrivals: [{ ...event(), memberId: context.tripId }] },
		{
			arrivals: [
				{
					...event(),
					samples: [{ ...event().samples[0], latitude: 91 }, ...event().samples.slice(1)],
				},
			],
		},
		{
			arrivals: [
				{
					...event(),
					samples: [
						{ ...event().samples[0], eventTime: "2026-10-26T00:00:00" },
						...event().samples.slice(1),
					],
				},
			],
		},
	])("rejects malformed or server-owned input %#", async (input) => {
		expect((await check(input)).length).toBeGreaterThan(0);
	});
});
