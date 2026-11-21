import type { EntityManager } from "typeorm";
import { IncidentLocationStatus, type IncidentSeverity } from "../incidents/incidents.enums";
import type { IncidentCategory } from "../incidents/incidents.enums";
import {
	INCIDENT_PROPOSAL_HAZARD_TYPES,
	INCIDENT_PROPOSAL_MAX_RADIUS_METERS,
	INCIDENT_PROPOSAL_MIN_RADIUS_METERS,
	INCIDENT_PROPOSAL_SEVERITY,
} from "./danger-zone-proposals.constants";
import type { DangerZoneHazardType } from "./danger-zone-proposals.enums";

export interface ReportedIncident {
	id: string;
	tripId: string;
	reporterId: string;
	category: IncidentCategory;
	severity: IncidentSeverity;
	description: string;
	occurredAt: string;
	latitude: number | null;
	longitude: number | null;
	locationAccuracyMeters: number | null;
	locationStatus: IncidentLocationStatus;
}

/** Eligible category with a fresh, server-classified position; anything else opens no proposal. */
export function incidentProposalHazardType(
	incident: ReportedIncident
): DangerZoneHazardType | null {
	const hasFreshPosition =
		incident.locationStatus === IncidentLocationStatus.FRESH &&
		incident.latitude !== null &&
		incident.longitude !== null;
	if (!hasFreshPosition) return null;
	return INCIDENT_PROPOSAL_HAZARD_TYPES[incident.category] ?? null;
}

export function incidentProposalRadius(accuracyMeters: number | null): number {
	const accuracy = Math.ceil(accuracyMeters ?? 0);
	return Math.min(
		Math.max(accuracy, INCIDENT_PROPOSAL_MIN_RADIUS_METERS),
		INCIDENT_PROPOSAL_MAX_RADIUS_METERS
	);
}

/**
 * Runs inside the incident insert transaction so a stored eligible incident always has its
 * pending proposal. It only queues work for an Admin; it never writes route_danger_zones.
 */
export async function insertIncidentProposal(
	manager: EntityManager,
	incident: ReportedIncident
): Promise<boolean> {
	const hazardType = incidentProposalHazardType(incident);
	if (!hazardType) return false;
	const inserted = (await manager.query(
		`INSERT INTO "danger_zone_proposals"
			("source", "route_id", "incident_id", "proposer_id", "hazard_type", "geom", "radius_m",
			 "severity", "description", "location_accuracy_meters", "observed_at")
		 SELECT 'INCIDENT', trip."route_id", $1, $2, $3,
			ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10
		 FROM "trips" trip WHERE trip."id" = $11
		 ON CONFLICT ("incident_id") DO NOTHING
		 RETURNING "id"`,
		[
			incident.id,
			incident.reporterId,
			hazardType,
			incident.longitude,
			incident.latitude,
			incidentProposalRadius(incident.locationAccuracyMeters),
			INCIDENT_PROPOSAL_SEVERITY[incident.severity],
			incident.description,
			incident.locationAccuracyMeters,
			incident.occurredAt,
			incident.tripId,
		]
	)) as Array<{ id: string }>;
	return inserted.length > 0;
}
