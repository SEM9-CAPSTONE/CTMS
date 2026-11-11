import { safetyText as t } from "../messages";
import type { SafetyFeature } from "../types";

const time = (value: string | null) =>
	value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa có";
const geometryRoles: Record<string, string> = {
	administrative_warning_area: "Vùng cảnh báo theo địa giới hành chính",
	source_event_marker: "Vị trí sự kiện do nguồn cung cấp",
	source_marker: "Vị trí do nguồn cung cấp",
	host_defined_area: "Phạm vi do Host đánh dấu",
	field_observation: "Vị trí ghi nhận sự cố",
	representative_event_location: "Điểm đại diện sự kiện, không phải đường bao vùng ảnh hưởng",
	mapped_water_resource: "Vị trí nguồn nước được lập bản đồ",
};

export function SafetyFeatureDetails({ feature }: { feature: SafetyFeature }) {
	const p = feature.properties;
	return (
		<details className="rounded-lg border bg-white p-3">
			<summary className="cursor-pointer font-semibold">
				<span className="mr-2">{p.description.split(" — ")[0].slice(0, 180)}</span>
				{t.sourceType[p.sourceType]} ·{" "}
				{p.sourceType === "RESOURCE" ? p.description.split(" — ")[0] : t.severity[p.severity]} ·{" "}
				{t.lifecycle[p.lifecycleStatus]}
			</summary>
			<p className="mt-2">{p.description}</p>
			<p>
				Nguồn: {p.source} · Loại: {p.hazardType} · {t.verification[p.verificationStatus]}
			</p>
			<p>
				{p.intersects ? "Giao với tuyến" : "Gần tuyến"} · {Math.round(p.distanceMeters)} m
			</p>
			<p>
				Quan sát: {time(p.observedAt)} · Phát tin / cập nhật nguồn: {time(p.issuedAt)}
			</p>
			<p>
				CTMS lấy dữ liệu: {time(p.fetchedAt)} · Hiệu lực từ: {time(p.validFrom)} · Đến:{" "}
				{time(p.validUntil)}
			</p>
			<p>
				Độ chính xác vị trí:{" "}
				{p.accuracyMeters === null ? "Chưa có thông tin" : `${p.accuracyMeters} m`} · Phạm vi:{" "}
				{geometryRoles[p.geometryRole] ?? "Theo phạm vi nguồn cung cấp"}
			</p>
			<p className="break-all">Tham chiếu nguồn: {p.sourceReference}</p>
			{p.sourceType === "RESOURCE" && <p>{t.waterDisclaimer}</p>}
		</details>
	);
}
