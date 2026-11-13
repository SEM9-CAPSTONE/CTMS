import { SAFETY_HOTSPOT_CRITERIA } from "./safety-hotspots.constants";

/** The only fields of a RouteDeviationEvent the clustering needs (BR-361: no location of a person). */
export interface ClusterableEvent {
	id: string;
	tripId: string;
	userId: string;
	startedAt: Date;
}

export interface HotspotCluster {
	/** Event whose start point is the cluster context: every member is within the radius of it. */
	anchorId: string;
	/** Member event ids, sorted. */
	eventIds: string[];
	eventCount: number;
	distinctTrips: number;
	distinctMembers: number;
}

/** BR-417 / BR-418: repeated events of one Trip or one Member count once. */
export function meetsCriteria(events: ClusterableEvent[]): boolean {
	return (
		events.length >= SAFETY_HOTSPOT_CRITERIA.minEvents &&
		new Set(events.map((event) => event.tripId)).size >= SAFETY_HOTSPOT_CRITERIA.minDistinctTrips &&
		new Set(events.map((event) => event.userId)).size >= SAFETY_HOTSPOT_CRITERIA.minDistinctMembers
	);
}

const earlier = (a: ClusterableEvent, b: ClusterableEvent) =>
	a.startedAt.getTime() - b.startedAt.getTime() || a.id.localeCompare(b.id);

/**
 * Deterministic anchor clustering of the events of ONE Route version. `neighbors` maps each event
 * id to the ids whose start point lies within the cluster radius of its start point (itself
 * included, computed in PostGIS). Repeatedly the largest qualifying neighbourhood (ties: earliest
 * anchor, then id) becomes a cluster and its events are removed, so every member is within the
 * radius of the anchor and no event is in two clusters. Stops when nothing qualifies.
 */
export function clusterEvents(
	events: ClusterableEvent[],
	neighbors: Map<string, ReadonlySet<string>>
): HotspotCluster[] {
	const byId = new Map(events.map((event) => [event.id, event]));
	const remaining = new Set(events.map((event) => event.id));
	const anchors = [...events].sort(earlier);
	const clusters: HotspotCluster[] = [];

	for (;;) {
		let best: { anchor: ClusterableEvent; members: ClusterableEvent[] } | null = null;
		for (const anchor of anchors) {
			if (!remaining.has(anchor.id)) continue;
			const members = [...(neighbors.get(anchor.id) ?? [])]
				.filter((id) => remaining.has(id))
				.map((id) => byId.get(id))
				.filter((event): event is ClusterableEvent => event !== undefined);
			if (!meetsCriteria(members)) continue;
			if (!best || members.length > best.members.length) best = { anchor, members };
		}
		if (!best) return clusters;

		for (const member of best.members) remaining.delete(member.id);
		clusters.push({
			anchorId: best.anchor.id,
			eventIds: best.members.map((event) => event.id).sort(),
			eventCount: best.members.length,
			distinctTrips: new Set(best.members.map((event) => event.tripId)).size,
			distinctMembers: new Set(best.members.map((event) => event.userId)).size,
		});
	}
}
