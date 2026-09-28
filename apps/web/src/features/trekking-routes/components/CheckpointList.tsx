import { Pencil } from "lucide-react";
import type { RouteCheckpoint } from "../types";

const typeLabels: Record<RouteCheckpoint["type"], string> = {
	start: "Bắt đầu",
	rest: "Nghỉ chân",
	water: "Nguồn nước",
	dangerous: "Nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Kết thúc",
};

interface CheckpointListProps {
	items: RouteCheckpoint[];
	disabled?: boolean;
	onEdit?: (checkpoint: RouteCheckpoint) => void;
}

export function CheckpointList({ items, disabled, onEdit }: CheckpointListProps) {
	if (items.length === 0) {
		return (
			<p
				data-testid="checkpoints-empty"
				className="mt-4 rounded-xl border border-dashed p-4 text-sm text-[#667a6d]"
			>
				Tuyến này chưa có điểm dừng.
			</p>
		);
	}
	return (
		<ol className="mt-4 grid gap-3" aria-label="Danh sách điểm dừng">
			{items.map((item) => (
				<li key={item.id} className="rounded-xl border border-[#e0ebe0] bg-[#f8fbf7] p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<strong>{item.name}</strong>
						<div className="flex items-center gap-2">
							<span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">
								{typeLabels[item.type]}
							</span>
							{onEdit && (
								<button
									type="button"
									disabled={disabled}
									onClick={() => onEdit(item)}
									className="rounded-lg border border-[#cbd9ce] bg-white px-2.5 py-1 text-xs font-bold disabled:opacity-50"
								>
									<Pencil className="mr-1 inline size-3.5" /> Sửa
								</button>
							)}
						</div>
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
