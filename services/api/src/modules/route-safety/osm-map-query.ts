import { objectRecord, readProviderJson } from "./nchmf-http";

export async function readMapWaterData(
	url: URL,
	envelope: number[],
	signal: AbortSignal,
	headers: HeadersInit
): Promise<Record<string, unknown>> {
	url.searchParams.set("bbox", envelope.join(","));
	const response = objectRecord(await readProviderJson(url, { signal, headers }));
	if (!Array.isArray(response.elements)) throw new Error("Invalid OSM map response");
	const records = response.elements.map(objectRecord);
	const nodes = new Map(
		records.filter((r) => r.type === "node").map((r) => [r.id, { lon: r.lon, lat: r.lat }])
	);
	const elements = records
		.filter((r) => {
			if (!r.tags || typeof r.tags !== "object" || Array.isArray(r.tags)) return false;
			const tags = r.tags as Record<string, unknown>;
			return (
				tags.natural === "spring" ||
				tags.amenity === "drinking_water" ||
				tags.amenity === "water_point" ||
				tags.man_made === "water_well" ||
				tags.waterway === "river" ||
				tags.waterway === "stream"
			);
		})
		.map((r) =>
			r.type === "way" && Array.isArray(r.nodes)
				? { ...r, geometry: r.nodes.map((id: unknown) => nodes.get(id)) }
				: r
		);
	return { ...response, elements };
}
