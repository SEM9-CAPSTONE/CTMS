import {
	RouteDeviationContextIssue,
	RouteDeviationEndReason,
} from "./route-deviation-analysis.enums";
import { packageContext } from "./route-deviation-analysis.service";
import {
	type ReplaySample,
	replayRouteDeviation,
	summarizeEpisode,
} from "./route-deviation-replay";

const T0 = Date.parse("2026-11-01T01:00:00.000Z");
let counter = 0;

/** Samples every 30 s (the V3 logging interval); `[distance, accuracy]` pairs, default accuracy 5 m. */
function track(...points: Array<number | [number, number | null]>): ReplaySample[] {
	return points.map((point, index) => {
		const [distance, accuracy] = Array.isArray(point) ? point : [point, 5];
		counter += 1;
		return {
			id: `log-${counter}`,
			eventTime: new Date(T0 + index * 30_000),
			accuracyMeters: accuracy,
			distanceMeters: distance,
			lng: 108 + index / 1000,
			lat: 16,
			routeFraction: index / 100,
			packageVersion: null,
		};
	});
}

describe("replayRouteDeviation (CTMS-115, mirrors the CTMS-312 detector)", () => {
	it("opens an episode on 3 consecutive valid samples > 50 m and closes on 3 < 20 m (AC3, AC4)", () => {
		const samples = track(5, 55, 60, 70, 80, 15, 10, 5, 5);
		const [episode, ...rest] = replayRouteDeviation(samples);
		expect(rest).toEqual([]);
		expect(episode).toMatchObject({
			start: samples[1],
			confirm: samples[3],
			end: samples[5],
			recoveryConfirm: samples[7],
			endReason: RouteDeviationEndReason.RECOVERED,
		});
		expect(episode.samples).toEqual(samples.slice(1, 5));
		expect(summarizeEpisode(episode)).toMatchObject({
			sampleCount: 4,
			validSampleCount: 4,
			maxDistanceMeters: 80,
			avgDistanceMeters: 66.25,
			maxDistanceSample: samples[4],
		});
	});

	it("needs strictly more than 50 m: 50 m and the 20–50 m buffer reset the off-route counter", () => {
		expect(replayRouteDeviation(track(55, 60, 50, 70, 80))).toEqual([]);
		expect(replayRouteDeviation(track(55, 60, 30, 70, 80))).toEqual([]);
		expect(replayRouteDeviation(track(55, 60, 30, 70, 80, 90))).toHaveLength(1);
	});

	it("treats accuracy > 20 m as invalid and resets the counter, exactly 20 m is valid (AC2, AC5)", () => {
		expect(replayRouteDeviation(track(55, 60, [70, 25], 80, 90))).toEqual([]);
		expect(replayRouteDeviation(track(55, [60, null], 70, 80, 90))).toHaveLength(1);
		expect(replayRouteDeviation(track([55, 20], [60, 20], [70, 20]))).toHaveLength(1);
	});

	it("an invalid sample also resets the recovery counter and stays in the episode", () => {
		const samples = track(60, 60, 60, 10, [10, 30], 10, 10, 10);
		const [episode] = replayRouteDeviation(samples);
		expect(episode.end).toBe(samples[5]);
		expect(episode.recoveryConfirm).toBe(samples[7]);
		expect(summarizeEpisode(episode)).toMatchObject({ sampleCount: 5, validSampleCount: 4 });
	});

	it("needs strictly less than 20 m to recover: exactly 20 m resets the recovery counter", () => {
		const [episode] = replayRouteDeviation(track(60, 60, 60, 10, 20, 10, 10, 10));
		expect(episode.endReason).toBe(RouteDeviationEndReason.RECOVERED);
		expect(episode.samples.map((s) => s.distanceMeters)).toEqual([60, 60, 60, 10, 20]);
	});

	it("resets the counters after 120 s without a valid sample (GPS degraded)", () => {
		const samples = track(60, 60, 60);
		samples[2] = { ...samples[2], eventTime: new Date(samples[1].eventTime.getTime() + 120_000) };
		expect(replayRouteDeviation(samples)).toEqual([]);
		samples[2] = { ...samples[2], eventTime: new Date(samples[1].eventTime.getTime() + 119_000) };
		expect(replayRouteDeviation(samples)).toHaveLength(1);
	});

	it("ends the episode with the evidence when the participant is still off route", () => {
		const samples = track(5, 60, 60, 60, 90, [80, 40]);
		const [episode] = replayRouteDeviation(samples);
		expect(episode).toMatchObject({
			end: samples[5],
			recoveryConfirm: null,
			endReason: RouteDeviationEndReason.EVIDENCE_ENDED,
		});
		expect(summarizeEpisode(episode)).toMatchObject({
			sampleCount: 5,
			validSampleCount: 4,
			maxDistanceMeters: 90,
		});
	});

	it("finds several episodes in one track", () => {
		expect(replayRouteDeviation(track(60, 60, 60, 5, 5, 5, 70, 70, 70, 5, 5, 5))).toHaveLength(2);
	});
});

describe("packageContext (BR-360, BR-363)", () => {
	it("uses the log version, else the Trip's offline package, else flags it missing", () => {
		expect(packageContext(["7"], { offlinePackageVersion: "3" })).toEqual({
			packageVersion: "7",
			issues: [],
		});
		expect(packageContext([], { offlinePackageVersion: "3" })).toEqual({
			packageVersion: "3",
			issues: [],
		});
		expect(packageContext([], { offlinePackageVersion: null })).toEqual({
			packageVersion: null,
			issues: [RouteDeviationContextIssue.PACKAGE_VERSION_MISSING],
		});
	});

	it("keeps an episode spanning two package versions out of authoritative evidence", () => {
		expect(packageContext(["3", "4"], { offlinePackageVersion: null })).toEqual({
			packageVersion: "3",
			issues: [RouteDeviationContextIssue.PACKAGE_VERSION_INCONSISTENT],
		});
	});
});
