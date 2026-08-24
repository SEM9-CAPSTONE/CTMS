import { VIETNAM_PROVINCES } from "../constants";
import type { PlaceSuggestion } from "../types";

interface GeocodingFeature {
	id?: string | number;
	display_name?: string;
	place_name?: string;
	text?: string;
	name?: string;
	lat?: string | number;
	lon?: string | number;
	latitude?: string | number;
	longitude?: string | number;
	geometry?: {
		coordinates?: [number, number];
	};
	context?: Array<{
		id?: string;
		text?: string;
		place_name?: string;
	}>;
	properties?: {
		city?: string;
		county?: string;
		region?: string;
		state?: string;
		province?: string;
	};
}

const LOCAL_SUGGESTIONS: PlaceSuggestion[] = [
	{
		id: "da-lat-pine-camp",
		label: "Da Lat Pine Camp, Lâm Đồng",
		latitude: 11.940419,
		longitude: 108.458313,
		province: "Lâm Đồng",
	},
	{
		id: "da-nang-son-tra-camp",
		label: "Son Tra Campsite, Đà Nẵng",
		latitude: 16.118721,
		longitude: 108.273438,
		province: "Đà Nẵng",
	},
	{
		id: "sa-pa-mountain-camp",
		label: "Sa Pa Mountain Camp, Lào Cai",
		latitude: 22.336102,
		longitude: 103.843781,
		province: "Lào Cai",
	},
];

function toFiniteNumber(value: string | number | undefined): number | null {
	const parsed = typeof value === "number" ? value : Number(value);

	return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFeature(feature: GeocodingFeature, index: number): PlaceSuggestion | null {
	const latitude = toFiniteNumber(
		feature.latitude ?? feature.lat ?? feature.geometry?.coordinates?.[1]
	);
	const longitude = toFiniteNumber(
		feature.longitude ?? feature.lon ?? feature.geometry?.coordinates?.[0]
	);
	const label = feature.place_name ?? feature.display_name ?? feature.text ?? feature.name;

	if (!label || latitude === null || longitude === null) {
		return null;
	}

	return {
		id: String(feature.id ?? `${label}-${index}`),
		label,
		latitude,
		longitude,
		province: inferProvinceFromFeature(feature, label),
	};
}

function searchLocalPlaces(query: string, province: string): PlaceSuggestion[] {
	const normalizedQuery = normalizeSearchText(query);
	const normalizedProvince = normalizeSearchText(province);

	if (normalizedQuery.length < 2) {
		return [];
	}

	return LOCAL_SUGGESTIONS.filter((suggestion) => {
		const label = normalizeSearchText(suggestion.label);
		const matchesQuery = label.includes(normalizedQuery);
		const matchesProvince = normalizedProvince === "" || label.includes(normalizedProvince);

		return matchesQuery && matchesProvince;
	});
}

function normalizeSearchText(value: string): string {
	return value.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

function inferProvinceFromFeature(feature: GeocodingFeature, label: string): string | undefined {
	const candidates = [
		feature.properties?.province,
		feature.properties?.region,
		feature.properties?.state,
		feature.properties?.city,
		feature.properties?.county,
		...(feature.context ?? []).flatMap((context) => [context.text, context.place_name]),
		label,
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidates) {
		const matchedProvince = inferProvinceFromText(candidate);

		if (matchedProvince) {
			return matchedProvince;
		}
	}

	return undefined;
}

function inferProvinceFromText(value: string): string | undefined {
	const normalizedValue = normalizeSearchText(value)
		.replace(/\btp\b/g, "thanh pho")
		.replace(/\btphcm\b/g, "thanh pho ho chi minh")
		.replace(/\bho chi minh city\b/g, "thanh pho ho chi minh");

	return VIETNAM_PROVINCES.find((province) => {
		const normalizedProvince = normalizeSearchText(province);
		const withoutPrefix = normalizedProvince.replace(/^thanh pho /, "");

		return normalizedValue.includes(normalizedProvince) || normalizedValue.includes(withoutPrefix);
	});
}

function buildMapTilerGeocodingUrl(query: string, apiKey: string): string {
	const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
	url.searchParams.set("key", apiKey);
	url.searchParams.set("language", "vi");

	return url.toString();
}

function buildMapTilerSearchUrl(query: string, apiKey: string): string {
	const url = new URL(buildMapTilerGeocodingUrl(query, apiKey));
	url.searchParams.set("autocomplete", "true");
	url.searchParams.set("country", "vn");

	return url.toString();
}

export const geocodingService = {
	searchPlaces: async (
		query: string,
		province: string,
		signal?: AbortSignal
	): Promise<PlaceSuggestion[]> => {
		const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;

		if (!apiKey) {
			return searchLocalPlaces(query, province);
		}
		const searchText = province.trim() ? `${query}, ${province}` : query;
		const response = await fetch(buildMapTilerSearchUrl(searchText, apiKey), { signal });

		if (!response.ok) {
			throw new Error("Geocoding search failed");
		}

		const data = (await response.json()) as GeocodingFeature[] | { features?: GeocodingFeature[] };
		const features = Array.isArray(data) ? data : (data.features ?? []);

		return features
			.map((feature, index) => normalizeFeature(feature, index))
			.filter((suggestion): suggestion is PlaceSuggestion => suggestion !== null);
	},

	reverseGeocode: async (
		latitude: number,
		longitude: number,
		signal?: AbortSignal
	): Promise<{ placeLabel: string; province?: string }> => {
		const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;

		if (!apiKey) {
			const placeLabel = `Vị trí đã chọn (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;

			return { placeLabel, province: inferProvinceFromText(placeLabel) };
		}
		const response = await fetch(buildMapTilerGeocodingUrl(`${longitude},${latitude}`, apiKey), {
			signal,
		});

		if (!response.ok) {
			throw new Error("Reverse geocoding failed");
		}

		const data = (await response.json()) as {
			label?: string;
			display_name?: string;
			name?: string;
			features?: GeocodingFeature[];
		};
		const firstFeature = data.features?.[0];
		const normalizedFeature = firstFeature ? normalizeFeature(firstFeature, 0) : null;

		const placeLabel =
			data.label ??
			data.display_name ??
			data.name ??
			normalizedFeature?.label ??
			`Vị trí đã chọn (${latitude}, ${longitude})`;

		return {
			placeLabel,
			province: normalizedFeature?.province ?? inferProvinceFromText(placeLabel),
		};
	},
};
