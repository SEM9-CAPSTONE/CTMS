export interface AuditLogListParams {
	actorId?: string;
	actor?: string;
	action?: string;
	targetId?: string;
	target?: string;
	targetType?: string;
	outcome?: "success" | "failure";
	startDate?: string;
	endDate?: string;
	page: number;
	limit: number;
}

export interface AuditLogSummary {
	id: string;
	actorId: string | null;
	actorName: string | null;
	action: string;
	targetType: string;
	targetId: string;
	before: Record<string, unknown> | null;
	after: Record<string, unknown> | null;
	reason: string | null;
	createdAt: string;
}

export interface AuditLogsPagination {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export interface PaginatedAuditLogsResponse {
	items: AuditLogSummary[];
	pagination: AuditLogsPagination;
}
