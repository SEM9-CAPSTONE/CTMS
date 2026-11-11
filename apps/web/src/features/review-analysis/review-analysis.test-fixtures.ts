import type { Batch, BatchResponse, InsightResponse } from "./types";
export const config = {
	provider: "gemini",
	model: "test-model",
	configVersion: "v1",
	promptVersion: "v1",
};
export const tripId = "22222222-2222-4222-8222-222222222222";
export const batch: Batch = {
	...config,
	id: "33333333-3333-4333-8333-333333333333",
	tripId,
	status: "running",
	createdAt: "2026-11-05T00:00:00Z",
	completedAt: null,
};
export function insightFixture(): InsightResponse {
	return {
		tripId,
		configuration: config,
		latestBatch: null,
		retryAfterSeconds: 0,
		coverage: {
			eligible: 9,
			analyzed: 8,
			pending: 0,
			failed: 0,
			stale: 0,
			unprocessed: 1,
			excluded: 0,
			ratio: 8 / 9,
		},
		freshness: { reviewChanged: 0, configurationChanged: 0, restricted: 0 },
		sentimentCounts: { positive: 6, neutral: 1, negative: 1, mixed: 0 },
		topics: [{ topic: "scenery", count: 6, denominator: 8 }],
		items: [
			{
				id: "result-1",
				reviewId: "44444444-4444-4444-8444-444444444444",
				sourceRevision: 2,
				sentiment: "positive",
				topics: ["scenery"],
				summary: "Cảnh đẹp. <img src=x onerror=alert(1)>",
				confidence: 0.9,
				actualModel: "test-model",
				analyzedAt: "2026-11-05T00:00:00Z",
			},
		],
		pagination: { page: 1, limit: 6, total: 8, totalPages: 2 },
	};
}
export function batchFixture(status: Batch["status"] = "running"): BatchResponse {
	return {
		batch: { ...batch, status },
		remainingCount: 1,
		hasMore: true,
		progress: {
			total: 1,
			pending: status === "running" ? 1 : 0,
			running: 0,
			succeeded: status === "succeeded" ? 1 : 0,
			failed: status === "failed" ? 1 : 0,
			skipped: 0,
			suppressed: 0,
		},
		items: [
			{
				id: "item-1",
				reviewId: "44444444-4444-4444-8444-444444444444",
				sourceRevision: 2,
				status: status === "running" ? "pending" : status === "succeeded" ? "succeeded" : "failed",
				current: status === "succeeded",
				freshnessReason: null,
				errorCode: null,
				analysis: null,
			},
		],
	};
}
