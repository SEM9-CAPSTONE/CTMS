import { UnprocessableEntityException } from "@nestjs/common";
import {
	IncidentCategory,
	IncidentLocationStatus,
	IncidentSeverity,
} from "../incidents/incidents.enums";
import { isAllowedHotspotTransition } from "../safety-hotspots/hotspot-review.service";
import { SafetyHotspotStatus } from "../safety-hotspots/safety-hotspots.enums";
import { DangerZoneHazardType } from "./danger-zone-proposals.enums";
import { approvedRadius } from "./danger-zone-proposals.service";
import {
	type ReportedIncident,
	incidentProposalHazardType,
	incidentProposalRadius,
} from "./incident-proposal";

const point = { type: "Point" as const, coordinates: [108.24, 16.06] as [number, number] };
const polygon = {
	type: "Polygon" as const,
	coordinates: [
		[
			[108.24, 16.06],
			[108.25, 16.06],
			[108.25, 16.07],
			[108.24, 16.06],
		] as Array<[number, number]>,
	],
};

function incident(overrides: Partial<ReportedIncident> = {}): ReportedIncident {
	return {
		id: "incident",
		tripId: "trip",
		reporterId: "porter",
		category: IncidentCategory.LOST_MEMBER,
		severity: IncidentSeverity.HIGH,
		description: "Mất liên lạc với một thành viên",
		occurredAt: "2026-11-16T03:00:00.000Z",
		latitude: 16.06,
		longitude: 108.24,
		locationAccuracyMeters: 12,
		locationStatus: IncidentLocationStatus.FRESH,
		...overrides,
	};
}

describe("incidentProposalHazardType", () => {
	it.each([
		[IncidentCategory.ROUTE_OBSTRUCTION, DangerZoneHazardType.ROUTE_OBSTRUCTION],
		[IncidentCategory.LOST_MEMBER, DangerZoneHazardType.LOST_MEMBER],
		[IncidentCategory.SLIPPERY_OR_LANDSLIDE, DangerZoneHazardType.SLIPPERY_OR_LANDSLIDE],
		[IncidentCategory.DAMAGED_BARRIER, DangerZoneHazardType.DAMAGED_BARRIER],
	])("queues %s with a fresh position", (category, hazardType) => {
		expect(incidentProposalHazardType(incident({ category }))).toBe(hazardType);
	});

	it.each([
		IncidentCategory.INJURY,
		IncidentCategory.ILLNESS,
		IncidentCategory.WILDLIFE,
		IncidentCategory.WEATHER_HAZARD,
	])("ignores %s", (category) => {
		expect(incidentProposalHazardType(incident({ category }))).toBeNull();
	});

	it.each([IncidentLocationStatus.STALE, IncidentLocationStatus.UNAVAILABLE])(
		"ignores a %s position",
		(locationStatus) => {
			expect(incidentProposalHazardType(incident({ locationStatus }))).toBeNull();
		}
	);

	it("ignores a report without coordinates", () => {
		expect(incidentProposalHazardType(incident({ latitude: null, longitude: null }))).toBeNull();
	});
});

describe("incidentProposalRadius", () => {
	it.each([
		[null, 30],
		[5, 30],
		[47.2, 48],
		[900, 200],
	])("accuracy %s m records %s m", (accuracy, radius) => {
		expect(incidentProposalRadius(accuracy)).toBe(radius);
	});
});

describe("approvedRadius", () => {
	it("keeps the proposed point radius unless the Admin sets one", () => {
		expect(approvedRadius({ geometry: point, radiusMeters: 40 }, undefined)).toBe(40);
		expect(approvedRadius({ geometry: point, radiusMeters: 40 }, 75)).toBe(75);
	});

	it("never gives an area a radius", () => {
		expect(approvedRadius({ geometry: polygon, radiusMeters: null }, undefined)).toBeNull();
		expect(() => approvedRadius({ geometry: polygon, radiusMeters: null }, 20)).toThrow(
			UnprocessableEntityException
		);
	});
});

describe("isAllowedHotspotTransition", () => {
	const { DETECTED, UNDER_REVIEW, CONFIRMED, DISMISSED } = SafetyHotspotStatus;

	it.each([
		[DETECTED, UNDER_REVIEW],
		[UNDER_REVIEW, CONFIRMED],
		[UNDER_REVIEW, DISMISSED],
	])("allows %s → %s", (from, to) => {
		expect(isAllowedHotspotTransition(from, to)).toBe(true);
	});

	it.each([
		[DETECTED, CONFIRMED],
		[DETECTED, DISMISSED],
		[CONFIRMED, DISMISSED],
		[DISMISSED, CONFIRMED],
		[CONFIRMED, UNDER_REVIEW],
	])("rejects %s → %s", (from, to) => {
		expect(isAllowedHotspotTransition(from, to)).toBe(false);
	});
});
