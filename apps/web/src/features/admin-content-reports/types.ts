export enum ReportStatus {
	PENDING = "pending",
	REVIEWING = "reviewing",
	ACTIONED = "actioned",
	REJECTED = "rejected",
}

export interface ContentReport {
	id: string;
	reporter: { id: string; fullName: string | null };
	targetType: string;
	targetId: string;
	reason: string;
	status: ReportStatus;
	createdAt: string;
	updatedAt: string;
}

export interface ReportQueue {
	items: ContentReport[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ReportTransition {
	expectedStatus: ReportStatus;
	status: ReportStatus;
}

export interface ReportError {
	status?: number;
	message: string;
}
