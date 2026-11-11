import type { UseQueryResult } from "@tanstack/react-query";
import { SAFETY_FEATURE_LIMIT, SAFETY_PROVIDERS, SEVERITY_ORDER } from "../constants";
import { isDisplayableFeature } from "../map-symbols";
import type { LiveSafetySource, RouteSafetyResult, SafetyFeature, SafetySeverity } from "../types";

export function combineSafetyQueries(queries: UseQueryResult<RouteSafetyResult, Error>[]) {
	const sources: LiveSafetySource[] = queries.map((query, index) => {
		const source = SAFETY_PROVIDERS[index];
		const fallback = { source, checkedAt: "", dataTime: null, validUntil: null };
		if (query.isFetching || query.isPending) return { ...fallback, status: "LOADING" };
		if (query.isError) return { ...fallback, status: "UNAVAILABLE" };
		return (
			query.data?.sources?.find((item) => item.source === source) ??
			(source === "NCHMF" ? query.data?.liveSource : undefined) ?? {
				...fallback,
				status: "UNAVAILABLE",
			}
		);
	});
	const completed = queries.flatMap((query) =>
		query.data && !query.isFetching && !query.isError ? [query.data] : []
	);
	let data: RouteSafetyResult | undefined;
	if (completed.length) {
		const unique = new Map<string, SafetyFeature>();
		for (const result of completed)
			for (const feature of result.features.features.filter(isDisplayableFeature))
				unique.set(feature.id, feature);
		const features = [...unique.values()]
			.sort(
				(a, b) =>
					a.properties.distanceMeters - b.properties.distanceMeters || a.id.localeCompare(b.id)
			)
			.slice(0, SAFETY_FEATURE_LIMIT);
		const active = features.filter(
			(f) => f.properties.lifecycleStatus === "ACTIVE" && f.properties.sourceType !== "RESOURCE"
		);
		const riskLevel = active.reduce<SafetySeverity>(
			(level, f) =>
				SEVERITY_ORDER[f.properties.severity] > SEVERITY_ORDER[level]
					? f.properties.severity
					: level,
			"UNKNOWN"
		);
		data = {
			...completed[0],
			sources,
			riskLevel,
			features: { type: "FeatureCollection", features },
			liveSource: completed.flatMap((r) => (r.liveSource ? [r.liveSource] : []))[0],
			analyzedAt:
				completed
					.map((r) => r.analyzedAt)
					.sort()
					.at(-1) ?? completed[0].analyzedAt,
			dataVersion: completed.map((r) => r.dataVersion).join(":"),
			truncated: unique.size > SAFETY_FEATURE_LIMIT || completed.some((r) => r.truncated),
			summary: {
				activeWarnings: active.filter((f) => f.properties.sourceType === "OFFICIAL_CURRENT").length,
				nearbyIncidents: active.filter((f) => f.properties.sourceType === "FIELD_OBSERVATION")
					.length,
				hostDefinedDangerZones: active.filter((f) => f.properties.sourceType === "HOST_DEFINED")
					.length,
				historicalFeatures: features.filter((f) => f.properties.lifecycleStatus === "HISTORICAL")
					.length,
			},
		};
	}
	return {
		data,
		sources,
		isFetching: queries.some((q) => q.isFetching),
		isError: queries.every((q) => q.isError && !q.isFetching),
		refetch: () => Promise.all(queries.map((q) => q.refetch())),
	};
}
