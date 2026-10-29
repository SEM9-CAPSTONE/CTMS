import { CalendarDays, MapPinned, Mountain, Siren, Users } from "lucide-react";
import { OVERVIEW_TEXT } from "../constants";
import type { HostOverview } from "../types";

export function OverviewKpis({ overview }: { overview: HostOverview }) {
	const bookingDate = overview.bookingDate.split("-").reverse().join("/");
	const items = [
		{
			label: OVERVIEW_TEXT.bookings,
			value: overview.kpis.todaysBookings,
			icon: CalendarDays,
			helper: bookingDate,
		},
		{
			label: OVERVIEW_TEXT.trips,
			value: overview.kpis.activeTrips,
			icon: Mountain,
			helper: "Đang vận hành",
		},
		{
			label: OVERVIEW_TEXT.routes,
			value: overview.kpis.routes,
			icon: MapPinned,
			helper: "Trong phạm vi quản lý",
		},
		{
			label: OVERVIEW_TEXT.porters,
			value: overview.kpis.assignedPorters,
			icon: Users,
			helper: "Gồm chờ xác nhận lại",
		},
		{
			label: OVERVIEW_TEXT.sos,
			value: overview.kpis.unresolvedSos,
			icon: Siren,
			helper: "Cần theo dõi",
		},
	];
	return (
		<section
			aria-label="Chỉ số vận hành"
			className="flex flex-wrap overflow-hidden rounded-2xl border border-[#e3e9e3] bg-white"
		>
			{items.map(({ label, value, icon: Icon, helper }) => (
				<div
					key={label}
					className="min-w-0 grow basis-1/2 border-b border-r border-[#edf1ec] px-4 py-4 sm:px-5 md:basis-1/3 xl:basis-1/5"
				>
					<div className="flex items-start justify-between gap-2">
						<p className="text-xs font-medium text-[#65756a]">{label}</p>
						<Icon aria-hidden="true" className="size-4 shrink-0 text-[#698773]" />
					</div>
					<p className="mt-2 text-3xl font-semibold tracking-tight text-[#153b28]">
						{value === null ? "—" : value.toLocaleString("vi-VN")}
					</p>
					<p className="mt-1 text-[11px] text-[#7b887f]">
						{value === null ? OVERVIEW_TEXT.noMetrics : helper}
					</p>
				</div>
			))}
		</section>
	);
}
