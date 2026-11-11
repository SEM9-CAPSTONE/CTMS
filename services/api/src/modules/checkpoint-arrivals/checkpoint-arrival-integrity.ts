import { createHash } from "node:crypto";
import { VALID_SAMPLE_MAX_ACCURACY_METERS } from "../safety-events/safety-events.constants";
import type { CheckpointArrivalInputDto } from "./checkpoint-arrivals.dto";
import {
	CHECKPOINT_ARRIVAL_DISTANCE_METERS,
	CHECKPOINT_ARRIVAL_SAMPLE_COUNT,
	type CheckpointArrivalContext,
	CheckpointArrivalRejection,
} from "./checkpoint-arrivals.types";

export function arrivalIntegrityRejection(
	event: CheckpointArrivalInputDto,
	context: CheckpointArrivalContext
): CheckpointArrivalRejection | null {
	if (
		event.routeId !== context.routeId ||
		event.routeVersion !== context.routeVersion ||
		event.packageId !== context.packageId ||
		event.packageVersion !== context.packageVersion
	) {
		return CheckpointArrivalRejection.CONTEXT_MISMATCH;
	}
	const checkpoint = context.checkpoints.find((item) => item.id === event.checkpointId);
	if (!checkpoint) return CheckpointArrivalRejection.CHECKPOINT_NOT_IN_PACKAGE;
	if (event.samples.length !== CHECKPOINT_ARRIVAL_SAMPLE_COUNT) {
		return CheckpointArrivalRejection.INVALID_SAMPLE_SEQUENCE;
	}
	const firstTime = Date.parse(event.samples[0].eventTime);
	const lastTime = Date.parse(event.samples[event.samples.length - 1].eventTime);
	if (!Number.isFinite(firstTime) || !Number.isFinite(lastTime) || lastTime - firstTime > 600_000) {
		return CheckpointArrivalRejection.INVALID_SAMPLE_SEQUENCE;
	}
	let previousTime = Number.NEGATIVE_INFINITY;
	for (let i = 0; i < event.samples.length; i++) {
		const sample = event.samples[i];
		const time = Date.parse(sample.eventTime);
		if (!Number.isFinite(time) || time <= previousTime) {
			return CheckpointArrivalRejection.INVALID_SAMPLE_SEQUENCE;
		}
		if (i > 0) {
			const delta = time - previousTime;
			if (delta < 1_000 || delta > 180_000) {
				return CheckpointArrivalRejection.INVALID_SAMPLE_SEQUENCE;
			}
		}
		previousTime = time;
		const dist = Math.round(distanceMeters(sample, checkpoint) * 1000) / 1000;
		if (
			!Number.isFinite(sample.accuracyMeters) ||
			sample.accuracyMeters < 0 ||
			sample.accuracyMeters > VALID_SAMPLE_MAX_ACCURACY_METERS ||
			!Number.isFinite(sample.latitude) ||
			Math.abs(sample.latitude) > 90 ||
			!Number.isFinite(sample.longitude) ||
			Math.abs(sample.longitude) > 180 ||
			dist > CHECKPOINT_ARRIVAL_DISTANCE_METERS
		) {
			return CheckpointArrivalRejection.THRESHOLD_NOT_MET;
		}
	}
	return null;
}

/** Great-circle distance; ignores configurable Route checkpoint radius_m (BR-239). */
export function distanceMeters(
	a: { latitude: number; longitude: number },
	b: { latitude: number; longitude: number }
): number {
	const radians = Math.PI / 180;
	const lat = (b.latitude - a.latitude) * radians;
	const lon = (b.longitude - a.longitude) * radians;
	const haversine =
		Math.sin(lat / 2) ** 2 +
		Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(lon / 2) ** 2;
	return 6_371_000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

/** Explicit ordered fields make retries independent of JSON property order/timezone notation. */
export function arrivalFingerprint(event: CheckpointArrivalInputDto): string {
	return createHash("sha256")
		.update(
			JSON.stringify([
				event.checkpointId,
				event.routeId,
				event.routeVersion,
				event.packageId,
				event.packageVersion,
				event.detectedOffline,
				event.samples.map((sample) => [
					new Date(sample.eventTime).toISOString(),
					sample.latitude,
					sample.longitude,
					sample.accuracyMeters,
				]),
			])
		)
		.digest("hex");
}
