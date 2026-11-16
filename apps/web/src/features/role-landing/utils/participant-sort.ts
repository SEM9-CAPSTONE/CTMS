import type { MapParticipant } from "../types/active-trip-map";
import { participantLabel } from "./participant-position";

export type ParticipantSort = "attention" | "name" | "code";
const freshnessOrder = { unavailable: 0, stale: 1, fresh: 2 };

/** Keep source indexes unchanged so sorting never renumbers map markers. */
export function sortMapParticipants<T extends MapParticipant>(
	participants: T[],
	order: ParticipantSort
) {
	return participants
		.map((participant, index) => ({ participant, index }))
		.sort((a, b) => {
			if (order === "code")
				return a.participant.role.localeCompare(b.participant.role) || a.index - b.index;
			const freshness =
				order === "attention"
					? freshnessOrder[a.participant.freshness] - freshnessOrder[b.participant.freshness]
					: 0;
			return (
				freshness ||
				participantLabel(a.participant).localeCompare(participantLabel(b.participant), "vi") ||
				a.index - b.index
			);
		});
}
