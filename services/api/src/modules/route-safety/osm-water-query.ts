import { setTimeout as delay } from "node:timers/promises";
import type { ConfigService } from "@nestjs/config";
import { objectRecord, providerUrl, readProviderJson } from "./nchmf-http";
import { readMapWaterData } from "./osm-map-query";
import { ROUTE_CONTEXT } from "./route-context.policy";

const PROVIDER_HEADERS = {
	"User-Agent": "CTMS/0.1 (trekking route safety; nearby water mapping)",
	Accept: "application/json",
};

export async function waterData(
	config: ConfigService,
	envelope: number[],
	signal: AbortSignal
): Promise<Record<string, unknown>> {
	const [west, south, east, north] = envelope;
	const bbox = `(${south},${west},${north},${east})`;
	const selectors = [
		'node["natural"="spring"]',
		'node["amenity"~"^(drinking_water|water_point)$"]',
		'node["man_made"="water_well"]',
		'way["waterway"~"^(stream|river)$"]',
	];
	const url = providerUrl(
		config.get<string>("ROUTE_SAFETY_OVERPASS_URL") ?? ROUTE_CONTEXT.overpassUrl
	);
	url.searchParams.set(
		"data",
		`[out:json][timeout:5];(${selectors.map((s) => `${s}${bbox};`).join("")});out meta geom ${ROUTE_CONTEXT.maxWaterRecords + 1};`
	);
	const overpass = async (requestSignal: AbortSignal) => {
		const response = objectRecord(
			await readProviderJson(url, { signal: requestSignal, headers: PROVIDER_HEADERS })
		);
		if (!Array.isArray(response.elements) || (response.remark && response.elements.length === 0))
			throw new Error("Incomplete Overpass response");
		return response;
	};
	if ((east - west) * (north - south) <= ROUTE_CONTEXT.maxMapEnvelopeArea) {
		const controller = new AbortController();
		const requestSignal = AbortSignal.any([signal, controller.signal]);
		try {
			const mapUrl = providerUrl(
				config.get<string>("ROUTE_SAFETY_OSM_MAP_URL") ?? ROUTE_CONTEXT.osmMapUrl
			);
			// Avoid waiting for a slow primary server before trying the second public reader.
			// Fast map responses cancel the delayed request before it starts; the first success cancels its peer.
			return await Promise.any([
				readMapWaterData(
					mapUrl,
					envelope,
					AbortSignal.any([requestSignal, AbortSignal.timeout(ROUTE_CONTEXT.overpassTimeoutMs)]),
					PROVIDER_HEADERS
				),
				delay(ROUTE_CONTEXT.waterHedgeDelayMs, undefined, { signal: requestSignal }).then(() =>
					overpass(requestSignal)
				),
			]);
		} finally {
			controller.abort();
		}
	}
	return overpass(signal);
}
