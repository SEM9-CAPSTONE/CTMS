import { createHash } from "node:crypto";
import { UnprocessableEntityException } from "@nestjs/common";

export const TRIP_TYPES = ["day_trip", "overnight"] as const;
export const DIFFICULTIES = ["easy", "moderate", "hard", "expert"] as const;
export const REASONS = ["observed_booking_interest", "advisory_not_forecast"] as const;
export interface DemandPolicy {
	minBookers: number;
	minHosts: number;
	maxHostShare: number;
}
export interface DemandSource {
	booking: string;
	booker: string;
	host: string;
	tripType: string;
	difficulty: string;
}
export interface DemandCell {
	tripType: string;
	difficulty: string | null;
	bookerBand: { min: number; max: number };
}
export interface DemandRelease {
	granularity: "trip_type_difficulty" | "trip_type";
	cells: DemandCell[];
}
export interface DemandSuggestion {
	tripType: string;
	difficulty: string | null;
	reason: (typeof REASONS)[number];
}
export const fingerprint = (value: unknown): string =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function monthWindow(month: string, now = new Date()) {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))
		throw new UnprocessableEntityException("Invalid closed month");
	const [year, number] = month.split("-").map(Number);
	const local = new Date(now.getTime() + 7 * 3600000);
	const distance = local.getUTCFullYear() * 12 + local.getUTCMonth() - (year * 12 + number - 1);
	if (distance < 1 || distance > 12)
		throw new UnprocessableEntityException("Use a closed month within the previous twelve months");
	return {
		start: new Date(Date.UTC(year, number - 1, 1, -7)),
		end: new Date(Date.UTC(year, number, 1, -7)),
	};
}
export function assertSettled(end: Date, days: number, now = new Date()): void {
	if (now.getTime() < end.getTime() + days * 86400000)
		throw new UnprocessableEntityException({
			code: "period_not_settled",
			message: "Reporting period has not settled",
			availableAt: new Date(end.getTime() + days * 86400000).toISOString(),
		});
}
export function releaseDemand(
	rows: DemandSource[],
	policy: DemandPolicy,
	fixed?: DemandRelease["granularity"]
): DemandRelease {
	const cellsAt = (fine: boolean): DemandCell[] => {
		const groups = new Map<string, DemandSource[]>();
		for (const row of rows) {
			if (
				!TRIP_TYPES.some((t) => t === row.tripType) ||
				!DIFFICULTIES.some((d) => d === row.difficulty)
			)
				continue;
			const key = JSON.stringify([row.tripType, fine ? row.difficulty : null]);
			const group = groups.get(key) ?? [];
			group.push(row);
			groups.set(key, group);
		}
		return [...groups.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.flatMap(([, group]) => {
				const bookers = new Set(group.map((r) => r.booker));
				const hosts = new Map<string, Set<string>>();
				for (const row of group) {
					const set = hosts.get(row.host) ?? new Set<string>();
					set.add(row.booker);
					hosts.set(row.host, set);
				}
				if (
					bookers.size < policy.minBookers ||
					hosts.size < policy.minHosts ||
					[...hosts.values()].some((s) => s.size / bookers.size > policy.maxHostShare)
				)
					return [];
				const min = Math.floor(bookers.size / 10) * 10;
				return [
					{
						tripType: group[0].tripType,
						difficulty: fine ? group[0].difficulty : null,
						bookerBand: { min, max: min + 9 },
					},
				];
			});
	};
	if (fixed) return { granularity: fixed, cells: cellsAt(fixed === "trip_type_difficulty") };
	const fine = cellsAt(true);
	return fine.length
		? { granularity: "trip_type_difficulty", cells: fine }
		: { granularity: "trip_type", cells: cellsAt(false) };
}
export function validateSuggestions(raw: unknown, cells: DemandCell[]): DemandSuggestion[] {
	if (
		!raw ||
		typeof raw !== "object" ||
		Object.keys(raw).join() !== "suggestions" ||
		!("suggestions" in raw) ||
		!Array.isArray(raw.suggestions) ||
		raw.suggestions.length > cells.length ||
		raw.suggestions.length === 0
	)
		throw new Error("invalid_output");
	const seen = new Set<string>();
	return raw.suggestions.map((item: unknown) => {
		if (
			!item ||
			typeof item !== "object" ||
			Object.keys(item).sort().join() !== "difficulty,reason,tripType" ||
			!("tripType" in item) ||
			!("difficulty" in item) ||
			!("reason" in item) ||
			!REASONS.some((r) => r === item.reason) ||
			!cells.some((c) => c.tripType === item.tripType && c.difficulty === item.difficulty)
		)
			throw new Error("invalid_output");
		const key = JSON.stringify([item.tripType, item.difficulty]);
		if (seen.has(key)) throw new Error("invalid_output");
		seen.add(key);
		return {
			tripType: item.tripType as string,
			difficulty: item.difficulty as string | null,
			reason: item.reason as DemandSuggestion["reason"],
		};
	});
}
