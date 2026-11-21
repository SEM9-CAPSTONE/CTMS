import { DANGER_ZONE_MAP_RADIUS_METERS } from "../trekking-routes/utils/danger-zone-map";
import { featureMarkerPoint } from "./map-symbols";
import { safetyText as t } from "./messages";
import type { SafetyFeature } from "./types";

export function safetyDetailView(feature: SafetyFeature) {
	const p = feature.properties;
	const water = p.sourceType === "RESOURCE";
	const verified = p.sourceType === "ADMIN_VERIFIED";
	const saved = verified || p.sourceType === "HOST_DEFINED";
	const title = verified
		? t.verifiedZone.title
		: water
			? "Thông tin nguồn nước"
			: "Thông tin điểm nguy hiểm";
	const source = verified
		? "Quản trị viên xác nhận"
		: p.sourceType === "HOST_DEFINED"
			? "Ghi nhận trên tuyến"
			: p.source;
	const fields: { label: string; value: string }[] = [
		{ label: "Nguồn", value: source },
		{ label: "Xác minh", value: t.verification[p.verificationStatus] },
	];
	if (!water) fields.push({ label: "Mức độ", value: t.severity[p.severity] });
	if (!saved) fields.push({ label: "Tình trạng thông tin", value: t.lifecycle[p.lifecycleStatus] });
	if (p.routeName) fields.push({ label: "Tuyến", value: p.routeName });
	if (p.radiusMeters !== null) {
		fields.push({ label: "Bán kính ghi nhận", value: `${p.radiusMeters} m` });
		if (saved)
			fields.push({
				label: "Vòng đánh dấu trên bản đồ",
				value: `${DANGER_ZONE_MAP_RADIUS_METERS} m`,
			});
	}
	const formatTime = (value: string) => {
		const date = new Date(value);
		return Number.isNaN(date.getTime())
			? "Chưa có thông tin"
			: date.toLocaleString("vi-VN", {
					timeZone: "Asia/Ho_Chi_Minh",
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hourCycle: "h23",
				});
	};
	fields.push({ label: "Cập nhật", value: formatTime(p.updatedAt) });
	if (p.observedAt && !saved)
		fields.push({ label: "Ghi nhận lúc", value: formatTime(p.observedAt) });
	if (p.issuedAt && !saved) fields.push({ label: "Phát hành lúc", value: formatTime(p.issuedAt) });
	if (p.validUntil) fields.push({ label: "Hiệu lực đến", value: formatTime(p.validUntil) });
	if (p.accuracyMeters !== null)
		fields.push({ label: "Độ chính xác vị trí", value: `${p.accuracyMeters} m` });
	const point = featureMarkerPoint(feature);
	if (point)
		fields.push({
			label: "Tọa độ",
			value: `${point.coordinates[1].toFixed(6)}, ${point.coordinates[0].toFixed(6)}`,
		});
	const note = water
		? t.waterDisclaimer
		: p.geometryRole === "administrative_warning_area"
			? "Đây là vùng cảnh báo theo địa giới xã."
			: undefined;
	return { title, fields, note };
}
