import {
	BEHIND_LAG_MINUTES,
	GUIDANCE,
	LOCATION_UNKNOWN_AFTER_MINUTES,
	SAFE_CHECKPOINT_TYPES,
	SEVERELY_BEHIND_LAG_MINUTES,
} from "./schedule-progress.constants";

export enum ScheduleStatus {
	ON_TRACK = "ON_TRACK",
	BEHIND = "BEHIND",
	SEVERELY_BEHIND = "SEVERELY_BEHIND",
	LOCATION_UNKNOWN = "LOCATION_UNKNOWN",
}

export enum BehindScheduleLevel {
	BEHIND = "BEHIND",
	SEVERELY_BEHIND = "SEVERELY_BEHIND",
}

export interface RouteCheckpoint {
	id: string;
	name: string;
	type: string;
	nearbyWaterOrShelter: boolean;
	/** Fraction (0..1) of the Route line where the Checkpoint projects. */
	routeFraction: number;
	latitude: number;
	longitude: number;
}

export interface LastValidSample {
	eventTime: Date;
	latitude: number;
	longitude: number;
	accuracyMeters: number;
	/** Fraction along the Route, or null when the sample is outside the on-route corridor. */
	routeFraction: number | null;
}

export interface CamperFacts {
	userId: string;
	/** Porter-confirmed Checkpoints this Camper's own VALID GPS proves they passed (§13.2). */
	passedCheckpointIds: ReadonlySet<string>;
	lastValidSample: LastValidSample | null;
}

export interface SafeCheckpointRef {
	id: string;
	name: string;
	type: string;
}

export interface CamperScheduleProgress {
	userId: string;
	status: ScheduleStatus;
	reference: { checkpointId: string; checkpointName: string; porterArrivedAt: Date } | null;
	lagMinutes: number | null;
	safeCheckpoint: SafeCheckpointRef | null;
	guidance: string | null;
	lastValidSampleAt: Date | null;
	/** Levels reached at this evaluation; each is persisted at most once (§13.3). */
	levelsReached: BehindScheduleLevel[];
}

const MINUTE_MS = 60_000;

export function isSafeCheckpoint(checkpoint: RouteCheckpoint): boolean {
	return SAFE_CHECKPOINT_TYPES.has(checkpoint.type) || checkpoint.nearbyWaterOrShelter;
}

/**
 * CTMS-063 §13: evaluate one Camper against the Porter baselines.
 *
 * The reference Checkpoint is the earliest (along the Route) Porter-confirmed Checkpoint the Camper
 * has not passed. Lag = now − T(X). Without a fresh VALID sample the result is LOCATION_UNKNOWN and
 * never "behind"; no Porter baseline means nothing to evaluate (ON_TRACK).
 */
export function evaluateCamper(input: {
	camper: CamperFacts;
	checkpoints: readonly RouteCheckpoint[];
	porterBaselines: ReadonlyMap<string, Date>;
	now: Date;
}): CamperScheduleProgress {
	const { camper, checkpoints, porterBaselines, now } = input;
	const base: CamperScheduleProgress = {
		userId: camper.userId,
		status: ScheduleStatus.ON_TRACK,
		reference: null,
		lagMinutes: null,
		safeCheckpoint: null,
		guidance: null,
		lastValidSampleAt: camper.lastValidSample?.eventTime ?? null,
		levelsReached: [],
	};

	const ordered = [...checkpoints].sort((a, b) => a.routeFraction - b.routeFraction);
	const reference = ordered.find(
		(checkpoint) =>
			porterBaselines.has(checkpoint.id) && !camper.passedCheckpointIds.has(checkpoint.id)
	);
	if (!reference) return base;

	const porterArrivedAt = porterBaselines.get(reference.id) as Date;
	const withReference: CamperScheduleProgress = {
		...base,
		reference: {
			checkpointId: reference.id,
			checkpointName: reference.name,
			porterArrivedAt,
		},
	};

	const sample = camper.lastValidSample;
	const locationKnown =
		sample !== null &&
		now.getTime() - sample.eventTime.getTime() <= LOCATION_UNKNOWN_AFTER_MINUTES * MINUTE_MS;
	if (!locationKnown) {
		return {
			...withReference,
			status: ScheduleStatus.LOCATION_UNKNOWN,
			guidance: GUIDANCE.locationUnknown,
		};
	}

	const lagMinutes = Math.floor((now.getTime() - porterArrivedAt.getTime()) / MINUTE_MS);
	if (lagMinutes < BEHIND_LAG_MINUTES) {
		return { ...withReference, lagMinutes: Math.max(0, lagMinutes) };
	}

	const severe = lagMinutes >= SEVERELY_BEHIND_LAG_MINUTES;
	const safe = severe
		? nearestSafeEitherDirection(ordered, sample)
		: nearestSafeAhead(ordered, sample, reference);
	const safeName = safe?.name;
	const guidance = !safeName
		? GUIDANCE.noSafeCheckpoint
		: severe
			? GUIDANCE.severelyBehind(safeName)
			: GUIDANCE.behind(lagMinutes, reference.name, safeName);

	return {
		...withReference,
		status: severe ? ScheduleStatus.SEVERELY_BEHIND : ScheduleStatus.BEHIND,
		lagMinutes,
		safeCheckpoint: safe ? { id: safe.id, name: safe.name, type: safe.type } : null,
		guidance,
		levelsReached: severe
			? [BehindScheduleLevel.BEHIND, BehindScheduleLevel.SEVERELY_BEHIND]
			: [BehindScheduleLevel.BEHIND],
	};
}

/** §13.4 BEHIND: nearest safe Checkpoint ahead of the Camper along the Route (often X itself). */
function nearestSafeAhead(
	ordered: readonly RouteCheckpoint[],
	sample: LastValidSample,
	reference: RouteCheckpoint
): RouteCheckpoint | null {
	// Off the corridor the Camper's position along the Route is unknown: "ahead" starts at X.
	const from = sample.routeFraction ?? reference.routeFraction;
	return (
		ordered.find(
			(checkpoint) => checkpoint.routeFraction >= from && isSafeCheckpoint(checkpoint)
		) ?? null
	);
}

/** §13.4 SEVERELY_BEHIND: nearest safe Checkpoint in either direction from the last VALID position. */
function nearestSafeEitherDirection(
	ordered: readonly RouteCheckpoint[],
	sample: LastValidSample
): RouteCheckpoint | null {
	let best: RouteCheckpoint | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const checkpoint of ordered) {
		if (!isSafeCheckpoint(checkpoint)) continue;
		const distance = haversineMeters(sample, checkpoint);
		if (distance < bestDistance) {
			best = checkpoint;
			bestDistance = distance;
		}
	}
	return best;
}

function haversineMeters(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number }
): number {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const dLat = toRad(b.latitude - a.latitude);
	const dLng = toRad(b.longitude - a.longitude);
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
	return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}
