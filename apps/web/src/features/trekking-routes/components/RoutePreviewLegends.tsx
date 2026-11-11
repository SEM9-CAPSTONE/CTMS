import type { RouteCheckpoint, RouteDangerZone } from "../types";
import { severityColors } from "../utils/route-preview";
interface Props {
	checkpoints: RouteCheckpoint[];
	dangerZones: RouteDangerZone[];
}
export function RoutePreviewLegends({ checkpoints, dangerZones }: Props) {
	const checkpointTypes = new Set(checkpoints.map((checkpoint) => checkpoint.type));
	const dangerZoneSeverities = new Set(dangerZones.map((zone) => zone.severity));
	const pointHazard = dangerZones.find((zone) => zone.geometry.type === "Point");
	const polygonHazard = dangerZones.find((zone) => zone.geometry.type === "Polygon");
	return (
		<>
			{checkpoints.length > 0 && (
				<div
					aria-label="Chú giải vị trí"
					className="absolute right-3 bottom-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold"
				>
					{checkpointTypes.has("start") && <span>S: Bắt đầu</span>}
					{checkpointTypes.has("finish") && <span>F: Kết thúc</span>}
					{checkpointTypes.has("rest") && <span>Số: Nghỉ chân</span>}
					{checkpointTypes.has("water") && <span className="text-teal-800">W: Nước</span>}
					{checkpointTypes.has("dangerous") && (
						<span className="text-red-700">!: Điểm nguy hiểm</span>
					)}
					{checkpointTypes.has("emergency_shelter") && (
						<span className="inline-flex items-center gap-1 text-sky-800">
							<span className="inline-flex size-4 items-center justify-center rounded bg-[#0369a1] text-xs font-extrabold text-white">
								⌂
							</span>
							Nơi trú ẩn
						</span>
					)}
				</div>
			)}
			{dangerZones.length > 0 && (
				<div
					aria-label="Chú giải khu vực nguy hiểm"
					className="absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg bg-white/90 px-3 py-2 text-[11px] font-bold"
				>
					{pointHazard && (
						<span className="inline-flex items-center gap-1 text-[#172554]">
							<span
								className="inline-flex size-5 items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow-[0_0_0_1px_#172554]"
								style={{ backgroundColor: severityColors[pointHazard.severity] }}
							>
								!
							</span>
							Điểm nguy hiểm
						</span>
					)}
					{polygonHazard && (
						<span className="inline-flex items-center gap-1 text-[#991b1b]">
							<span
								className="inline-block size-4 rounded-sm border-2 border-[#991b1b]"
								style={{
									backgroundColor: severityColors[polygonHazard.severity],
									opacity: 0.55,
								}}
							/>
							Khu vực nguy hiểm
						</span>
					)}
					<span className="text-[#34483b]">Mức độ:</span>
					{dangerZoneSeverities.has("low") && <span className="text-yellow-700">Thấp</span>}
					{dangerZoneSeverities.has("medium") && (
						<span className="text-orange-700">Trung bình</span>
					)}
					{dangerZoneSeverities.has("high") && <span className="text-red-700">Cao</span>}
				</div>
			)}
		</>
	);
}
