import { safetyText as t } from "./messages";
import type { SafetyFeature } from "./types";

export function safetyPopupContent(feature: SafetyFeature): HTMLDivElement {
	const p = feature.properties;
	const container = document.createElement("div");
	container.className = "grid max-w-60 gap-1 text-xs text-slate-800";
	const title = document.createElement("strong");
	title.textContent = p.description.split(" — ")[0].slice(0, 160);
	container.append(title);
	const rows = [
		`${p.source} · ${p.sourceType === "RESOURCE" ? "Nguồn nước" : t.severity[p.severity]}`,
		p.sourceType === "RESOURCE" ? "Chưa xác minh nước uống được." : t.lifecycle[p.lifecycleStatus],
	];
	const time = p.issuedAt ?? p.observedAt;
	if (time)
		rows.push(
			`Mốc dữ liệu: ${new Date(time).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
		);
	if (p.validUntil)
		rows.push(
			`Hiệu lực đến: ${new Date(p.validUntil).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`
		);
	if (p.geometryRole === "administrative_warning_area")
		rows.push("Vùng cảnh báo theo địa giới xã.");
	for (const text of rows) {
		const row = document.createElement("p");
		row.textContent = text;
		container.append(row);
	}
	return container;
}
