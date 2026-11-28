export interface VerificationPosition {
	id: string;
	page: number;
	bbox: { l: number; t: number; r: number; b: number; coord_origin: string };
	label: string;
	kind: string;
	instruction?: string;
	emptyForm?: boolean;
	originalText: string;
	alternativeText?: string | null;
	text: string;
	resolved: boolean;
	canExclude: boolean;
	needsVisualCheck: boolean;
	needsAnchor: boolean;
	afterItemRef?: string | null;
	anchors: Array<{ ref: string; text: string }>;
	blocks?: Array<{ ref: string; text: string }>;
	table?: {
		num_rows: number;
		num_cols: number;
		table_cells: Array<{
			text: string;
			start_row_offset_idx: number;
			end_row_offset_idx: number;
			start_col_offset_idx: number;
			end_col_offset_idx: number;
		}>;
	};
}
export interface ContentVerification {
	notice?: string | null;
	inUse?: boolean;
	automaticRecoveryPending?: boolean;
	chunkCount?: number;
	completedAt?: string | null;
	extractionId: string | null;
	revision: number;
	preparing: boolean;
	available: boolean;
	complete: boolean;
	positions: VerificationPosition[];
}
export interface VerificationSubmission {
	extractionId: string;
	requestId: string;
	expectedRevision: number;
	action: "confirm" | "correct" | "describe" | "exclude";
	text: string;
	source_checked: boolean;
	context_checked: boolean;
	visual_checked: boolean;
	reason?: string;
	after_item_ref?: string;
	block_texts?: Record<string, string>;
}
