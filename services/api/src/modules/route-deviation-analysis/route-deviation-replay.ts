import {
	GPS_DEGRADED_AFTER_SECONDS,
	OFF_ROUTE_MIN_DISTANCE_METERS,
	ON_ROUTE_MAX_DISTANCE_METERS,
	ROUTE_DEVIATION_CONSECUTIVE_SAMPLES,
	VALID_SAMPLE_MAX_ACCURACY_METERS,
} from "../safety-events/safety-events.constants";
import { RouteDeviationEndReason } from "./route-deviation-analysis.enums";

/** One stored GPS log of one participant, with its distance to the Trip's Route. */
export interface ReplaySample {
	id: string;
	eventTime: Date;
	accuracyMeters: number | null;
	distanceMeters: number;
	lng: number;
	lat: number;
	/** Position along the Route, 0..1 (ST_LineLocatePoint). */
	routeFraction: number;
	packageVersion: string | null;
}

export interface ReplayEpisode {
	/** First of the consecutive off-route samples. */
	start: ReplaySample;
	/** The sample that confirmed OFF_ROUTE (3rd consecutive). */
	confirm: ReplaySample;
	/** First of the consecutive recovery samples, or the last sample when evidence ended. */
	end: ReplaySample;
	/** The sample that confirmed the recovery; null when evidence ended off route. */
	recoveryConfirm: ReplaySample | null;
	endReason: RouteDeviationEndReason;
	/** Every sample from `start` up to (not including) the recovery run, invalid ones included. */
	samples: ReplaySample[];
}

const isValid = (sample: ReplaySample) =>
	sample.accuracyMeters !== null && sample.accuracyMeters <= VALID_SAMPLE_MAX_ACCURACY_METERS;

/**
 * CTMS-115 AC3–AC5: replays one participant's logs (sorted by time) with the same rules as the
 * on-device detector (CTMS-312), so a historical episode means what a live OFF_ROUTE meant:
 * - only samples with accuracy ≤ 20 m are valid; an invalid sample resets both counters;
 * - OFF_ROUTE after 3 consecutive valid samples strictly farther than 50 m (20–50 m resets);
 * - back ON_ROUTE after 3 consecutive valid samples strictly closer than 20 m;
 * - no valid sample for ≥ 120 s resets both counters (GPS degraded) without changing the state.
 */
export function replayRouteDeviation(samples: ReplaySample[]): ReplayEpisode[] {
	const episodes: ReplayEpisode[] = [];
	let offRun: ReplaySample[] = [];
	let recoveryRun: ReplaySample[] = [];
	let open: { start: ReplaySample; confirm: ReplaySample; samples: ReplaySample[] } | null = null;
	let lastValidAt: number | null = null;

	const resetCounters = () => {
		offRun = [];
		recoveryRun = [];
	};

	for (const sample of samples) {
		const time = sample.eventTime.getTime();
		if (!isValid(sample)) {
			// AC5: an invalid sample resets the applicable consecutive counter.
			resetCounters();
			open?.samples.push(sample);
			continue;
		}
		if (lastValidAt !== null && time - lastValidAt >= GPS_DEGRADED_AFTER_SECONDS * 1000) {
			resetCounters();
		}
		lastValidAt = time;

		if (!open) {
			offRun = sample.distanceMeters > OFF_ROUTE_MIN_DISTANCE_METERS ? [...offRun, sample] : [];
			if (offRun.length === ROUTE_DEVIATION_CONSECUTIVE_SAMPLES) {
				open = { start: offRun[0], confirm: sample, samples: [...offRun] };
				resetCounters();
			}
			continue;
		}

		recoveryRun =
			sample.distanceMeters < ON_ROUTE_MAX_DISTANCE_METERS ? [...recoveryRun, sample] : [];
		if (recoveryRun.length === ROUTE_DEVIATION_CONSECUTIVE_SAMPLES) {
			// The episode keeps everything before the recovery run.
			const firstRecovery = recoveryRun[0];
			episodes.push({
				start: open.start,
				confirm: open.confirm,
				end: firstRecovery,
				recoveryConfirm: sample,
				endReason: RouteDeviationEndReason.RECOVERED,
				samples: open.samples.filter(
					(s) => s.eventTime.getTime() < firstRecovery.eventTime.getTime()
				),
			});
			open = null;
			resetCounters();
			continue;
		}
		open.samples.push(sample);
	}

	if (open) {
		const last = open.samples[open.samples.length - 1];
		episodes.push({
			start: open.start,
			confirm: open.confirm,
			end: last,
			recoveryConfirm: null,
			endReason: RouteDeviationEndReason.EVIDENCE_ENDED,
			samples: open.samples,
		});
	}
	return episodes;
}

export interface EpisodeSummary {
	sampleCount: number;
	validSampleCount: number;
	maxDistanceMeters: number;
	avgDistanceMeters: number;
	maxDistanceSample: ReplaySample;
	packageVersions: string[];
}

/** BR-353: counts and distance summary over the episode's valid samples. */
export function summarizeEpisode(episode: ReplayEpisode): EpisodeSummary {
	const valid = episode.samples.filter(isValid);
	const maxDistanceSample = valid.reduce(
		(max, s) => (s.distanceMeters > max.distanceMeters ? s : max),
		valid[0]
	);
	const avg = valid.reduce((sum, s) => sum + s.distanceMeters, 0) / valid.length;
	const packageVersions = [
		...new Set(episode.samples.map((s) => s.packageVersion).filter((v): v is string => !!v)),
	];
	return {
		sampleCount: episode.samples.length,
		validSampleCount: valid.length,
		maxDistanceMeters: Number(maxDistanceSample.distanceMeters.toFixed(2)),
		avgDistanceMeters: Number(avg.toFixed(2)),
		maxDistanceSample,
		packageVersions,
	};
}
