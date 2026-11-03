export type SosStatus = "active" | "acknowledged" | "cancelled" | "closed";
export type EmergencyType = "medical" | "injury" | "lost" | "natural_hazard" | "other";

export interface SosLocation {
	latitude: number;
	longitude: number;
}

export interface SosAlertItem {
	id: string;
	tripId: string;
	tripTitle?: string | null;
	senderId: string;
	senderName?: string | null;
	senderEmail?: string | null;
	emergencyType: EmergencyType;
	location: SosLocation | null;
	batteryLevel: number | null;
	eventTime: string;
	status: SosStatus;
	cancelledBy: string | null;
	cancelledAt: string | null;
	cancellationReason: string | null;
	acknowledgedBy: string | null;
	acknowledgedByName?: string | null;
	acknowledgedAt: string | null;
	closedBy: string | null;
	closedByName?: string | null;
	closedAt: string | null;
	resolutionNote: string | null;
	receivedAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface HostSosListResponse {
	items: SosAlertItem[];
	total: number;
	page: number;
	limit: number;
}

export interface HostSosFilterParams {
	status?: SosStatus | "all";
	tripId?: string;
	search?: string;
	page?: number;
	limit?: number;
}
