export interface DepartureNotice {
	id: string;
	tripId: string;
	reasonCode: string;
	createdAt: string;
	readAt: string | null;
	active: boolean;
	tripTitle?: string;
	startsAt?: string;
	resolved?: boolean;
}
