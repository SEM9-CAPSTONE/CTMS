import type { DemandRelease, DemandSource } from "../demand-insights.policy";
export const PRICE_BANDS = ["free", "under_500k", "500k_to_1m", "1m_plus"] as const;
export const CAPACITY_BANDS = ["1_to_10", "11_to_20", "21_to_40", "41_plus"] as const;
export const DURATION_BANDS = ["day", "one_night", "two_plus_nights"] as const;
export const FOCUS_CODES = [
	"balanced_pace",
	"clear_inclusions",
	"group_organization",
	"overnight_preparation",
	"price_transparency",
] as const;
export type FocusCode = (typeof FOCUS_CODES)[number];
export interface PlanningSource extends DemandSource {
	snapshotType: string | null;
	snapshotDifficulty: string | null;
	priceBand: string | null;
	capacityBand: string | null;
	durationBand: string | null;
	areaCode: string | null;
	areaLabel: string | null;
	areaActive: boolean | null;
}
export interface PlanningCandidate {
	candidateId: string;
	tripType: string;
	difficulty: string | null;
	bookerBand: { min: number; max: number };
	priceBand: string | null;
	capacityBand: string | null;
	durationBand: string | null;
	area: { code: string; label: string; provenance: "host_confirmed_catalog" } | null;
}
export interface PlanningChoice {
	candidateId: string;
	focusCodes: FocusCode[];
}
export interface PlanningContext {
	version: "planning-v1";
	candidates: PlanningCandidate[];
}
export function buildPlanningContext(
	release: DemandRelease,
	rows: PlanningSource[]
): PlanningContext {
	const candidates = release.cells.map((cell, index) => {
		const cohort = rows.filter(
			(r) =>
				r.tripType === cell.tripType &&
				(cell.difficulty === null || r.difficulty === cell.difficulty)
		);
		const complete =
			cohort.length > 0 &&
			cohort.every((r) => r.snapshotType === r.tripType && r.snapshotDifficulty === r.difficulty);
		const uniform = (
			field: "priceBand" | "capacityBand" | "durationBand",
			allowed: readonly string[]
		) => {
			const value = cohort[0]?.[field];
			return complete && value && allowed.includes(value) && cohort.every((r) => r[field] === value)
				? value
				: null;
		};
		const first = cohort[0];
		const area =
			complete &&
			first?.areaCode &&
			first.areaLabel &&
			first.areaActive &&
			cohort.every(
				(r) => r.areaCode === first.areaCode && r.areaLabel === first.areaLabel && r.areaActive
			)
				? {
						code: first.areaCode,
						label: first.areaLabel,
						provenance: "host_confirmed_catalog" as const,
					}
				: null;
		return {
			candidateId: `c${index + 1}`,
			tripType: cell.tripType,
			difficulty: cell.difficulty,
			bookerBand: cell.bookerBand,
			priceBand: uniform("priceBand", PRICE_BANDS),
			capacityBand: uniform("capacityBand", CAPACITY_BANDS),
			durationBand: uniform("durationBand", DURATION_BANDS),
			area,
		};
	});
	return { version: "planning-v1", candidates };
}
export function allowedFocus(candidate: PlanningCandidate): FocusCode[] {
	return [
		"balanced_pace",
		"clear_inclusions",
		...(candidate.capacityBand ? ["group_organization" as const] : []),
		...(candidate.tripType === "overnight" ? ["overnight_preparation" as const] : []),
		...(candidate.priceBand ? ["price_transparency" as const] : []),
	];
}
export function validatePlanning(raw: unknown, candidates: PlanningCandidate[]): PlanningChoice[] {
	if (
		!raw ||
		typeof raw !== "object" ||
		Object.keys(raw).join() !== "recommendations" ||
		!("recommendations" in raw) ||
		!Array.isArray(raw.recommendations) ||
		raw.recommendations.length < 1 ||
		raw.recommendations.length > candidates.length
	)
		throw new Error("invalid_output");
	const seen = new Set<string>();
	return raw.recommendations.map((item: unknown) => {
		if (
			!item ||
			typeof item !== "object" ||
			Object.keys(item).sort().join() !== "candidateId,focusCodes" ||
			!("candidateId" in item) ||
			typeof item.candidateId !== "string" ||
			!("focusCodes" in item) ||
			!Array.isArray(item.focusCodes) ||
			item.focusCodes.length < 1 ||
			item.focusCodes.length > 3
		)
			throw new Error("invalid_output");
		const candidate = candidates.find((c) => c.candidateId === item.candidateId);
		if (
			!candidate ||
			seen.has(candidate.candidateId) ||
			new Set(item.focusCodes).size !== item.focusCodes.length ||
			!item.focusCodes.every(
				(code: unknown) =>
					typeof code === "string" && allowedFocus(candidate).some((c) => c === code)
			)
		)
			throw new Error("invalid_output");
		seen.add(candidate.candidateId);
		return { candidateId: candidate.candidateId, focusCodes: item.focusCodes as FocusCode[] };
	});
}
const ADVICE: Record<FocusCode, string> = {
	balanced_pace: "Bố trí nhịp hoạt động và thời gian nghỉ phù hợp với độ khó đã chọn.",
	clear_inclusions: "Trình bày rõ lịch trình, dịch vụ bao gồm và điều kiện tham gia.",
	group_organization:
		"Đối chiếu quy mô tham khảo với năng lực hỗ trợ và giới hạn của tuyến trước khi quyết định số chỗ.",
	overnight_preparation: "Chuẩn bị phương án nghỉ đêm và thông tin vật dụng cần mang theo.",
	price_transparency:
		"Tham khảo khoảng giá đã ghi nhận, đồng thời tính chi phí thực tế và công bố rõ các khoản bao gồm.",
};
const PRICE_LABELS: Record<string, string> = {
	free: "Miễn phí",
	under_500k: "Dưới 500.000 VND/người",
	"500k_to_1m": "Từ 500.000 đến dưới 1.000.000 VND/người",
	"1m_plus": "Từ 1.000.000 VND/người",
};
const CAPACITY_LABELS: Record<string, string> = {
	"1_to_10": "1–10 chỗ",
	"11_to_20": "11–20 chỗ",
	"21_to_40": "21–40 chỗ",
	"41_plus": "Từ 41 chỗ",
};
const DURATION_LABELS: Record<string, string> = {
	day: "Trong ngày",
	one_night: "Một đêm",
	two_plus_nights: "Từ hai đêm",
};
export function presentPlanning(choices: PlanningChoice[], candidates: PlanningCandidate[]) {
	return choices.map((choice) => {
		const candidate = candidates.find((c) => c.candidateId === choice.candidateId);
		if (!candidate) throw new Error("invalid_output");
		return {
			...candidate,
			priceRangeLabel: candidate.priceBand ? PRICE_LABELS[candidate.priceBand] : null,
			capacityRangeLabel: candidate.capacityBand ? CAPACITY_LABELS[candidate.capacityBand] : null,
			durationLabel: candidate.durationBand ? DURATION_LABELS[candidate.durationBand] : null,
			evidenceBasis: "observed_bookings",
			capacityMeaning: "offered_at_booking",
			generalAdvice: choice.focusCodes.map((code) => ({ code, text: ADVICE[code] })),
			disclaimer:
				"Thống kê mô tả, không phải giá hoặc quy mô tối ưu và không đảm bảo số người tham gia.",
		};
	});
}
