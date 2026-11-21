export type ReportType = "inaccurate_information" | "dangerous_content";
export interface ReportContext {
	targetId: string;
	label: string;
	comment: string | null;
	createdAt: string;
}
export interface ReportInput {
	idempotencyKey: string;
	reportType: ReportType;
	targetType: "trip_review";
	targetId: string;
	description: string;
}
export interface OwnReport {
	id: string;
	reportType: string;
	targetType: string;
	targetId: string;
	description: string;
	status: string;
	createdAt: string;
	updatedAt: string;
}
export interface OwnReportPage {
	items: OwnReport[];
	pagination: { page: number; limit: number; total: number; totalPages: number };
}
