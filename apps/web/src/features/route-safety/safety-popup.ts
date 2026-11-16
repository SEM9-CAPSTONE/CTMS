import { safetyText as t } from "./messages";
import type { SafetyFeature } from "./types";

export function safetyPopupContent(feature: SafetyFeature): HTMLDivElement {
	const p = feature.properties;
	const container = document.createElement("div");
	container.className = "grid max-w-60 gap-1 text-xs text-slate-800";
	const title = document.createElement("strong");
	const savedZone = p.sourceType === "HOST_DEFINED";
	title.textContent = savedZone ? t.savedZone.title : p.description.split(" — ")[0].slice(0, 160);
	container.append(title);
	const rows = savedZone
		? [
				t.savedZone.source,
				...(p.routeName ? [`${t.savedZone.route}: ${p.routeName}`] : []),
				`${t.savedZone.severity}: ${t.severity[p.severity]}`,
				`${t.savedZone.verification}: ${t.verification[p.verificationStatus]}`,
				p.description,
			]
		: [
				`${p.source} · ${p.sourceType === "RESOURCE" ? "Nguồn nước" : t.severity[p.severity]}`,
				p.sourceType === "RESOURCE"
					? "Chưa xác minh nước uống được."
					: t.lifecycle[p.lifecycleStatus],
			];
	if (savedZone) {
		if (p.radiusMeters !== null) rows.push(`${t.savedZone.radius}: ${p.radiusMeters} m`);
		const updatedAt = new Date(p.updatedAt);
		const options = { timeZone: "Asia/Ho_Chi_Minh" };
		const date = updatedAt.toLocaleDateString("vi-VN", {
			...options,
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});
		const time = updatedAt.toLocaleTimeString("vi-VN", {
			...options,
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		});
		rows.push(`${t.savedZone.updatedAt}: ${date} ${time}`);
	}
	const time = p.issuedAt ?? p.observedAt;
	if (time && !savedZone)
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
		row.className = "whitespace-pre-wrap break-words";
		row.textContent = text;
		container.append(row);
	}
	return container;
}
