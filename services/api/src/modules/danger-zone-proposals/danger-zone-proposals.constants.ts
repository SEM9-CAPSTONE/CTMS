import { IncidentCategory, IncidentSeverity } from "../incidents/incidents.enums";
import { RouteDangerZoneSeverity } from "../trekking-routes/entities/route-danger-zone.entity";
import { DangerZoneHazardType } from "./danger-zone-proposals.enums";

/**
 * User-approved 2026-11-16: only these field incident categories, reported with a fresh position,
 * open a proposal. A lost-member report marks where the member went missing for Admin review; it
 * never becomes a hazard without that review.
 */
export const INCIDENT_PROPOSAL_HAZARD_TYPES: Partial<
	Record<IncidentCategory, DangerZoneHazardType>
> = {
	[IncidentCategory.ROUTE_OBSTRUCTION]: DangerZoneHazardType.ROUTE_OBSTRUCTION,
	[IncidentCategory.LOST_MEMBER]: DangerZoneHazardType.LOST_MEMBER,
	[IncidentCategory.SLIPPERY_OR_LANDSLIDE]: DangerZoneHazardType.SLIPPERY_OR_LANDSLIDE,
	[IncidentCategory.DAMAGED_BARRIER]: DangerZoneHazardType.DAMAGED_BARRIER,
};

export const INCIDENT_PROPOSAL_SEVERITY: Record<IncidentSeverity, RouteDangerZoneSeverity> = {
	[IncidentSeverity.LOW]: RouteDangerZoneSeverity.LOW,
	[IncidentSeverity.MEDIUM]: RouteDangerZoneSeverity.MEDIUM,
	[IncidentSeverity.HIGH]: RouteDangerZoneSeverity.HIGH,
	[IncidentSeverity.CRITICAL]: RouteDangerZoneSeverity.HIGH,
};

/** Recorded radius for an incident position: the GPS accuracy, kept within a sensible range. */
export const INCIDENT_PROPOSAL_MIN_RADIUS_METERS = 30;
export const INCIDENT_PROPOSAL_MAX_RADIUS_METERS = 200;

export const DANGER_ZONE_PROPOSAL_LIST_LIMIT = 200;
