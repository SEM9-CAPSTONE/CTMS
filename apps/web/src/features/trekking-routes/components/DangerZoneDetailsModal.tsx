import { SafetyDetailsModal } from "../../route-safety/components/SafetyDetailsModal";
import type { SafetyFeature } from "../../route-safety/types";
import type { RouteDangerZone } from "../types";

export function DangerZoneDetailsModal({
	zone,
	onClose,
}: { zone: RouteDangerZone; onClose: () => void }) {
	const feature: SafetyFeature = {
		type: "Feature",
		id: `host:${zone.id}`,
		geometry: zone.geometry,
		properties: {
			sourceType: "HOST_DEFINED",
			source: "CTMS",
			sourceReference: zone.id,
			hazardType: "host_defined",
			severity: ({ low: "LOW", medium: "MEDIUM", high: "HIGH" } as const)[zone.severity],
			geometryRole: "host_defined_area",
			description: zone.description,
			radiusMeters: zone.radiusMeters,
			updatedAt: zone.updatedAt,
			observedAt: zone.createdAt,
			issuedAt: null,
			fetchedAt: null,
			validFrom: null,
			validUntil: null,
			lifecycleStatus: "ACTIVE",
			verificationStatus: "UNVERIFIED",
			accuracyMeters: null,
			distanceMeters: 0,
			intersects: false,
		},
	};
	return <SafetyDetailsModal feature={feature} onClose={onClose} />;
}
