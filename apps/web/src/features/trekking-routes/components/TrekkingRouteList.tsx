import { Clock3, MapPinned, Mountain, Route } from "lucide-react";
import type { CreatedTrekkingRoute, RouteDifficulty, RouteStatus } from "../types";

interface TrekkingRouteListProps {
	items: CreatedTrekkingRoute[];
	selectedRouteId?: string;
	onSelect: (route: CreatedTrekkingRoute) => void;
}

const difficultyLabels: Record<RouteDifficulty, string> = {
	easy: "Dễ",
	moderate: "Trung bình",
	hard: "Khó",
	expert: "Chuyên gia",
};

const statusLabels: Record<RouteStatus, string> = {
	draft: "Nháp",
	pending_approval: "Chờ duyệt",
	active: "Đang hoạt động",
	closed: "Đã đóng",
};

function formatLength(lengthMeters: number): string {
	return lengthMeters >= 1000
		? `${(lengthMeters / 1000).toFixed(2)} km`
		: `${lengthMeters.toFixed(0)} m`;
}

function formatCreatedAt(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
	}).format(new Date(value));
}

export function TrekkingRouteList({ items, selectedRouteId, onSelect }: TrekkingRouteListProps) {
	return (
		<div className="space-y-3" aria-label="Danh sách tuyến đường">
			{items.map((route) => {
				const selected = route.id === selectedRouteId;
				return (
					<button
						key={route.id}
						type="button"
						aria-pressed={selected}
						onClick={() => onSelect(route)}
						className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-[#164027] bg-emerald-50 ring-2 ring-[#164027]/10" : "border-[#dfe8df] bg-white hover:border-[#9db5a3]"}`}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3 className="truncate font-extrabold text-[#10221b]">{route.name}</h3>
								<p className="mt-1 text-xs font-semibold text-[#667a6d]">
									Tạo lúc {formatCreatedAt(route.createdAt)}
								</p>
							</div>
							<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-[#164027] ring-1 ring-[#cbd9ce]">
								{statusLabels[route.status]}
							</span>
						</div>
						<div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#52665b] sm:grid-cols-4">
							<span className="flex items-center gap-1">
								<Mountain className="size-3.5" />
								{difficultyLabels[route.difficulty]}
							</span>
							<span className="flex items-center gap-1">
								<Clock3 className="size-3.5" />
								{route.expectedDurationMinutes} phút
							</span>
							<span className="flex items-center gap-1">
								<Route className="size-3.5" />
								{formatLength(route.lengthMeters)}
							</span>
							<span className="flex items-center gap-1">
								<MapPinned className="size-3.5" />
								{route.geometry.coordinates.length} điểm
							</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
