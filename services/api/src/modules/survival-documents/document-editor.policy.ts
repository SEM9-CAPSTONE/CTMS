import { createHash } from "node:crypto";
import type { SourceVersion } from "./survival-documents.types";

export interface EditorItem {
	kind: "heading" | "paragraph" | "list" | "table";
	text: string;
	rows: string[][];
}

export interface ExtractedSection {
	heading: string;
	items: EditorItem[];
	pages: number[];
	item_refs: string[];
}

export interface EditorSection extends ExtractedSection {
	id: string;
	fingerprint: string;
	source: {
		versionId: string;
		versionNumber: number;
		checksum: string;
	} | null;
	edited?: boolean;
}

export enum EditAction {
	KEEP = "KEEP",
	REPLACE = "REPLACE",
	REMOVE = "REMOVE",
	RESTORE = "RESTORE",
	INSERT = "INSERT",
	REORDER = "REORDER",
}

export const fingerprint = (input: unknown) =>
	createHash("sha256").update(JSON.stringify(input)).digest("hex");
export function sourceSections(
	sections: ExtractedSection[],
	version: SourceVersion
): EditorSection[] {
	return sections.map((section) => ({
		...section,
		id: fingerprint([version.id, section.item_refs]),
		fingerprint: fingerprint(section.items),
		source: {
			versionId: version.id,
			versionNumber: version.versionNumber,
			checksum: version.checksum,
		},
	}));
}
