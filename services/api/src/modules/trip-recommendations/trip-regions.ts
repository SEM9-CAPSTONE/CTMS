/**
 * CTMS-106. Trips run in Đà Nẵng for now and have no stored area, so the area is derived from the
 * meeting point. Each area has a few well-known anchor points; a meeting point takes the area of its
 * nearest anchor. It is a ranking signal only (never an eligibility rule); points far from every
 * anchor (outside Đà Nẵng) have no area.
 */
export const TRIP_REGIONS = [
	{ code: "son_tra", label: "Bán đảo Sơn Trà" },
	{ code: "hai_van_lien_chieu", label: "Hải Vân – Liên Chiểu" },
	{ code: "ba_na_hoa_vang", label: "Bà Nà – Hòa Vang" },
	{ code: "ngu_hanh_son", label: "Ngũ Hành Sơn – ven biển" },
	{ code: "city_center", label: "Trung tâm thành phố" },
] as const;

export type TripRegionCode = (typeof TRIP_REGIONS)[number]["code"];

export const TRIP_REGION_CODES: readonly TripRegionCode[] = TRIP_REGIONS.map(
	(region) => region.code
);

/** Beyond this distance from every anchor the point is treated as outside Đà Nẵng. */
const MAX_ANCHOR_DISTANCE_KM = 12;

type Anchor = readonly [latitude: number, longitude: number, region: TripRegionCode];

const ANCHORS: readonly Anchor[] = [
	[16.12, 108.28, "son_tra"], // Đỉnh Bàn Cờ
	[16.1, 108.28, "son_tra"], // Chùa Linh Ứng
	[16.1, 108.3, "son_tra"], // Bãi Bụt
	[16.13, 108.25, "son_tra"], // Ghềnh Bàng
	[16.19, 108.13, "hai_van_lien_chieu"], // Đèo Hải Vân
	[16.12, 108.13, "hai_van_lien_chieu"], // Nam Ô
	[16.08, 108.15, "hai_van_lien_chieu"], // Hòa Khánh
	[15.997, 107.99, "ba_na_hoa_vang"], // Bà Nà
	[15.97, 108.04, "ba_na_hoa_vang"], // Hòa Phú Thành
	[16.12, 108.05, "ba_na_hoa_vang"], // Hòa Bắc
	[16.03, 108.03, "ba_na_hoa_vang"], // Hòa Ninh
	[16.0, 108.27, "ngu_hanh_son"], // Ngũ Hành Sơn
	[15.98, 108.28, "ngu_hanh_son"], // Bãi biển Non Nước
	[16.06, 108.22, "city_center"], // Hải Châu
	[16.07, 108.19, "city_center"], // Thanh Khê
	[16.02, 108.2, "city_center"], // Cẩm Lệ
];

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const dLat = toRadians(lat2 - lat1);
	const dLng = toRadians(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function regionForPoint(
	latitude: number | null | undefined,
	longitude: number | null | undefined
): TripRegionCode | null {
	if (
		typeof latitude !== "number" ||
		typeof longitude !== "number" ||
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude)
	) {
		return null;
	}
	let best: Anchor | null = null;
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const anchor of ANCHORS) {
		const distance = distanceKm(latitude, longitude, anchor[0], anchor[1]);
		if (distance < bestDistance) {
			best = anchor;
			bestDistance = distance;
		}
	}
	return best && bestDistance <= MAX_ANCHOR_DISTANCE_KM ? best[2] : null;
}

export function isTripRegionCode(value: unknown): value is TripRegionCode {
	return typeof value === "string" && (TRIP_REGION_CODES as readonly string[]).includes(value);
}
