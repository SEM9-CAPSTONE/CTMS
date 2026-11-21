import { describe, expect, it } from "vitest";
import type { MapParticipant } from "../types/active-trip-map";
import { participantMapCode } from "./participant-position";
import { sortMapParticipants } from "./participant-sort";

function person(
	name: string,
	freshness: MapParticipant["freshness"],
	role: MapParticipant["role"] = "camper"
): MapParticipant {
	return {
		id: name,
		name,
		role,
		freshness,
		location: null,
		lastSeenAt: null,
		safety: { route: null, gps: null },
	};
}
describe("Host member ordering", () => {
	const source = [
		person("Bùi Thu Hà", "fresh"),
		person("Trần Quốc Huy", "stale", "porter"),
		person("Huỳnh Bích Trâm", "unavailable"),
		person("Đặng Ngọc Lan", "stale"),
	];
	it("keeps missing, stale, then fresh as the attention order with names within each group", () => {
		expect(sortMapParticipants(source, "attention").map((item) => item.participant.name)).toEqual([
			"Huỳnh Bích Trâm",
			"Đặng Ngọc Lan",
			"Trần Quốc Huy",
			"Bùi Thu Hà",
		]);
	});
	it("sorts all names without applying freshness priority when explicitly requested", () => {
		expect(sortMapParticipants(source, "name").map((item) => item.participant.name)).toEqual([
			"Bùi Thu Hà",
			"Đặng Ngọc Lan",
			"Huỳnh Bích Trâm",
			"Trần Quốc Huy",
		]);
	});
	it("compares C/P code numbers numerically and preserves source identities", () => {
		const people = Array.from({ length: 10 }, (_, index) =>
			person(`Nguyễn Văn An ${index}`, "fresh", index === 0 ? "porter" : "camper")
		);
		const ordered = sortMapParticipants(people, "code");
		expect(
			ordered.map(({ participant, index }) => participantMapCode(participant.role, index))
		).toEqual(["C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "P1"]);
		expect(ordered[0].participant).toBe(people[1]);
		expect(people[0].role).toBe("porter");
	});
});
