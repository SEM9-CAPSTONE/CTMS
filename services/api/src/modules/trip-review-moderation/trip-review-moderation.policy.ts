import {
	MODERATION_AUTO_HIDE_THRESHOLD_BPS,
	MODERATION_BASIS_POINTS_SCALE,
	MODERATION_NOTIFY_HOST_MIN_THRESHOLD_BPS,
} from "./trip-review-moderation.constants";
import type {
	AutoModerationOutcome,
	DetectionSource,
	EvaluableModerationFlag,
	ModerationFlagType,
} from "./trip-review-moderation.types";

const FLAG_TIE_BREAK_PRIORITY: Record<ModerationFlagType, number> = {
	personal_data_leak: 5,
	harassment: 4,
	inappropriate_image: 3,
	profanity_or_insult: 2,
	spam_or_irrelevant: 1,
};

/**
 * Converts a raw confidence score [0, 1] into integer basis points [0, 10000]
 * so threshold comparisons avoid IEEE-754 floating-point boundary drift.
 * Deterministic server-rule flags (PII leak) evaluate as 10000 bps (100%).
 */
export function confidenceToBasisPoints(
	confidence: number | null,
	detectionSource: DetectionSource
): number {
	if (detectionSource === "rule") {
		return MODERATION_BASIS_POINTS_SCALE;
	}
	if (confidence === null || !Number.isFinite(confidence)) {
		return 0;
	}
	const clamped = Math.max(0, Math.min(1, confidence));
	return Math.round(clamped * MODERATION_BASIS_POINTS_SCALE);
}

/**
 * Evaluates all active flags of the current review revision against the
 * auto-hide threshold (> 8000 bps / strictly > 80%).
 */
export function evaluateModerationPolicy(
	flags: readonly EvaluableModerationFlag[]
): AutoModerationOutcome {
	if (flags.length === 0) {
		return { action: "clean", maxConfidenceBps: 0 };
	}

	let bestFlag = flags[0];
	let bestBps = confidenceToBasisPoints(bestFlag.confidence, bestFlag.detectionSource);

	for (let i = 1; i < flags.length; i += 1) {
		const candidate = flags[i];
		const candidateBps = confidenceToBasisPoints(candidate.confidence, candidate.detectionSource);
		if (
			candidateBps > bestBps ||
			(candidateBps === bestBps &&
				FLAG_TIE_BREAK_PRIORITY[candidate.flagType] > FLAG_TIE_BREAK_PRIORITY[bestFlag.flagType])
		) {
			bestFlag = candidate;
			bestBps = candidateBps;
		}
	}

	if (bestBps > MODERATION_AUTO_HIDE_THRESHOLD_BPS) {
		return {
			action: "auto_hide",
			hiddenReason: bestFlag.flagType,
			maxConfidenceBps: bestBps,
		};
	}

	if (bestBps >= MODERATION_NOTIFY_HOST_MIN_THRESHOLD_BPS) {
		return {
			action: "notify_host",
			maxConfidenceBps: bestBps,
		};
	}

	return {
		action: "clean",
		maxConfidenceBps: bestBps,
	};
}
