import { CalendarDays, MapPinned, Mountain, Siren, Users } from "lucide-react";
import { RoutePath } from "../../../routes/routes.config";
import { OVERVIEW_TEXT } from "../constants";
import type { HostOverview } from "../types";
import { openOverviewDetail } from "../utils";

export function OverviewKpis({ overview }: { overview: HostOverview }) {
	const bookingDate = overview.bookingDate.split("-").reverse().join("/");
	const items = [
		{
			label: OVERVIEW_TEXT.bookings,
			value: overview.kpis.todaysBookings,
			icon: CalendarDays,
			helper: bookingDate,
			action: () => {
				window.history.pushState({}, "", `${RoutePath.HOST_CAMPERS}?status=published`);
				window.dispatchEvent(new PopStateEvent("popstate"));
			},
		},
		{
			label: OVERVIEW_TEXT.trips,
			value: overview.kpis.activeTrips,
			icon: Mountain,
			helper: "Đang vận hành",
			action: () => {
				window.history.pushState({}, "", `${RoutePath.HOST_CAMPERS}?status=ongoing`);
				window.dispatchEvent(new PopStateEvent("popstate"));
			},
		},
		{
			label: OVERVIEW_TEXT.routes,
			value: overview.kpis.routes,
			icon: MapPinned,
			helper: "Trong phạm vi quản lý",
			action: () => openOverviewDetail(RoutePath.HOST_TREKKING_ROUTES),
		},
		{
			label: OVERVIEW_TEXT.porters,
			value: overview.kpis.assignedPorters,
			icon: Users,
			helper: "Trong các chuyến đang mở",
			action: () => {
				window.history.pushState({}, "", `${RoutePath.HOST_PORTER}?view=assigned`);
				window.dispatchEvent(new PopStateEvent("popstate"));
			},
		},
		{
			label: OVERVIEW_TEXT.sos,
			value: overview.kpis.unresolvedSos,
			icon: Siren,
			helper: "Chờ tiếp nhận hoặc đang hỗ trợ",
			action: () =>
				document.getElementById("host-rescue-requests")?.scrollIntoView({ behavior: "smooth" }),
		},
	];
	return (
		<section
			aria-label="Chỉ số vận hành"
			className="flex flex-wrap overflow-hidden rounded-2xl border border-[#e3e9e3] bg-white"
		>
			{items.map(({ label, value, icon: Icon, helper, action }) => (
				<button
					key={label}
					type="button"
					onClick={action}
					className="min-w-0 grow basis-1/2 border-b border-r border-[#edf1ec] px-4 py-4 text-left transition-colors hover:bg-[#f8fbf7] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#23583b] md:basis-1/3 xl:basis-1/5"
					aria-label={`${label}: ${value === null ? OVERVIEW_TEXT.noMetrics : value.toLocaleString("vi-VN")}. Mở mục chi tiết`}
				>
					<div className="flex items-start justify-between gap-2">
						<p className="text-xs font-medium text-[#65756a]">{label}</p>
						<Icon aria-hidden="true" className="size-4 shrink-0 text-[#698773]" />
					</div>
					<p className="mt-2 text-3xl font-semibold tracking-tight text-[#153b28]">
						{value === null ? "—" : value.toLocaleString("vi-VN")}
					</p>
					{value === null ? (
						<p className="mt-1 text-[11px] text-[#7b887f]">{OVERVIEW_TEXT.noMetrics}</p>
					) : helper ? (
						<p className="mt-1 text-[11px] text-[#7b887f]">{helper}</p>
					) : null}
				</button>
			))}
		</section>
	);
}
