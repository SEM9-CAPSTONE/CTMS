import { describe, expect, it } from "vitest";
import { displayAuditSnapshot, displayAuditText } from "./audit-display";

describe("audit display", () => {
	it("hides old fixture annotations while preserving an administrator's resolution note", () => {
		const notes =
			"Dữ liệu mẫu CTMS-114 để thử trên giao diện.\n[Giải quyết]: Đã nhận tiền hoàn trả từ người tổ chức.";
		const snapshot = { notes, status: "resolved" };
		const displayed = displayAuditSnapshot(snapshot);
		expect(displayed).toContain("Đã nhận tiền hoàn trả từ người tổ chức.");
		expect(displayed).not.toContain("CTMS-114");
		expect(displayed).not.toContain("Dữ liệu mẫu");
		expect(snapshot.notes).toBe(notes);
	});
	it("keeps useful changes and removes internal references without modifying the audit record", () => {
		const id = "d1140000-0004-4114-8114-000000000002";
		const snapshot = {
			bookingId: id,
			status: "resolved",
			amount: "900000.00",
			details: { id, name: "Nguyễn Văn An" },
		};
		const original = JSON.stringify(snapshot);
		const displayed = displayAuditSnapshot(snapshot);
		expect(displayed).toContain("resolved");
		expect(displayed).toContain("Nguyễn Văn An");
		expect(displayed).toContain("900000.00");
		expect(displayed).not.toContain(id);
		expect(JSON.stringify(snapshot)).toBe(original);
		expect(displayAuditText(`Đã xử lý đơn ${id}`)).not.toContain(id);
	});
});
