const internalIdPattern = /\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi;

export function displayAuditText(value: string): string {
	return value
		.replace(/Dữ liệu mẫu CTMS-\d+ để thử trên giao diện\./g, "")
		.replace(internalIdPattern, "[tham chiếu nội bộ]")
		.trim();
}

/** Presentation only: the original audit snapshots remain unchanged. */
export function displayAuditSnapshot(snapshot: Record<string, unknown>): string {
	return JSON.stringify(
		snapshot,
		(key: string, value: unknown) => {
			if (/^(id|.*Id|.*Ids|.*_id|.*_ids)$/.test(key)) return undefined;
			return typeof value === "string" ? displayAuditText(value) || undefined : value;
		},
		2
	);
}
