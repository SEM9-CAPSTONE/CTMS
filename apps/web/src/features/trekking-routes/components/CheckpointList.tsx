import type { RouteCheckpoint } from "../types";

const typeLabels: Record<RouteCheckpoint["type"], string> = {
	start: "Bắt đầu",
	rest: "Nghỉ chân",
	water: "Nguồn nước",
	dangerous: "Nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Kết thúc",
};

export function CheckpointList({ items }: { items: RouteCheckpoint[] }) {
	if (items.length === 0) {
		return (
			<p
				data-testid="checkpoints-empty"
				className="mt-4 rounded-xl border border-dashed p-4 text-sm text-[#667a6d]"
			>
				Tuyến này chưa có checkpoint.
			</p>
		);
	}
	return (
		<ol className="mt-4 grid gap-3" aria-label="Danh sách checkpoint">
			{items.map((item) => (
				<li key={item.id} className="rounded-xl border border-[#e0ebe0] bg-[#f8fbf7] p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<strong>{item.name}</strong>
						<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
							{typeLabels[item.type]}
						</span>
					</div>
					<p className="mt-2 text-sm text-[#52675a]">{item.instructions}</p>
					<p className="mt-2 text-xs font-bold text-[#667a6d]">
						Bán kính {item.radiusMeters} m · Đến sau {item.expectedArrivalOffset} phút · Vị trí
						tuyến {(item.routePosition * 100).toFixed(1)}%
					</p>
				</li>
			))}
		</ol>
	);
}
