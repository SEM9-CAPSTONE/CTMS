import type { RouteDangerZone } from "../types";
import { severityLabels } from "./route-preview";

export function dangerZonePopupContent(zone: RouteDangerZone): HTMLDivElement {
	const container = document.createElement("div");
	container.className = "grid max-w-60 gap-1 text-xs text-slate-800";
	const title = document.createElement("strong");
	title.textContent = "Điểm nguy hiểm";
	container.append(title);
	const severity = severityLabels[zone.severity];
	const rows = [
		`Mức độ: ${severity[0].toLocaleUpperCase("vi-VN")}${severity.slice(1)}`,
		zone.description,
	];
	if (zone.radiusMeters !== null) rows.push(`Bán kính: ${zone.radiusMeters} m`);
	const updatedAt = new Date(zone.updatedAt);
	const date = new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(updatedAt);
	const time = new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(updatedAt);
	rows.push(`Cập nhật: ${date} ${time}`);
	for (const text of rows) {
		const row = document.createElement("p");
		row.className = "whitespace-pre-wrap break-words";
		row.textContent = text;
		container.append(row);
	}
	return container;
}
