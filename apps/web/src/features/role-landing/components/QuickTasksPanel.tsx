import { ArrowRight, CalendarPlus, MapPinned, Route } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import type { DashboardConfig } from "../types";

export interface QuickTasksPanelProps {
	config: DashboardConfig;
	onOpenAdminUsers?: () => void;
	onCreateTrip?: () => void;
	onCreateTrekkingRoute?: () => void;
	onViewTrekkingRoutes?: () => void;
}

export function QuickTasksPanel({
	config,
	onOpenAdminUsers,
	onCreateTrip,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
}: QuickTasksPanelProps) {
	return (
		<div className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-extrabold text-[#10221b]">Tác vụ nhanh</h2>
					<p className="mt-1 text-sm font-medium text-[#667a6d]">
						Các thao tác chính được expose theo role hiện tại.
					</p>
				</div>
				{config.role === "admin" && onOpenAdminUsers && (
					<Button onClick={onOpenAdminUsers} className="gap-2">
						<span>Quản lý user</span>
						<ArrowRight className="size-4" />
					</Button>
				)}
				{config.role === "host" && onCreateTrekkingRoute && (
					<div className="flex flex-col gap-2 sm:flex-row">
						{onCreateTrip && (
							<Button onClick={() => onCreateTrip()} className="gap-2">
								<CalendarPlus className="size-4" />
								<span>Tạo trip</span>
							</Button>
						)}
						<Button onClick={() => onCreateTrekkingRoute()} variant="outline" className="gap-2">
							<Route className="size-4" />
							<span>Tạo tuyến</span>
						</Button>
					</div>
				)}
				{config.role === "host" && onViewTrekkingRoutes && (
					<Button onClick={() => onViewTrekkingRoutes()} variant="outline" className="gap-2">
						<MapPinned className="size-4" />
						<span>Quản lý tuyến trekking</span>
					</Button>
				)}
			</div>
			<div className="mt-5 grid gap-3 md:grid-cols-3">
				{config.tasks.map((task) => {
					const Icon = task.icon;
					return (
						<div key={task.label} className="rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4">
							<div
								className="flex size-10 items-center justify-center rounded-xl text-white"
								style={{ backgroundColor: config.accent }}
							>
								<Icon className="size-5" />
							</div>
							<p className="mt-4 text-sm font-bold text-[#667a6d]">{task.label}</p>
							<p className="mt-1 text-xl font-extrabold text-[#10221b]">{task.value}</p>
						</div>
					);
				})}
			</div>
		</div>
	);
}
