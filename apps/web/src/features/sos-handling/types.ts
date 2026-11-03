export type SosStatus = "active" | "acknowledged" | "cancelled" | "closed";
export type EmergencyType = "medical" | "injury" | "lost" | "natural_hazard" | "other";

export interface SosLocation {
	latitude: number;
	longitude: number;
}

export interface SosAlertItem {
	id: string;
	tripId: string;
	senderId: string;
	emergencyType: EmergencyType;
	location: SosLocation | null;
	batteryLevel: number | null;
	eventTime: string;
	status: SosStatus;
	cancelledBy: string | null;
	cancelledAt: string | null;
	cancellationReason: string | null;
	acknowledgedBy: string | null;
	acknowledgedAt: string | null;
	closedBy: string | null;
	closedAt: string | null;
	resolutionNote: string | null;
	receivedAt: string;
	createdAt: string;
	updatedAt: string;
}
