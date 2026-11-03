import { CalendarDays, Plus } from "lucide-react";

export function HostDashboardHeader({
	name,
	onCreateTrip,
}: { name: string; onCreateTrip?: () => void }) {
	const date = new Intl.DateTimeFormat("vi-VN", {
		timeZone: "Asia/Ho_Chi_Minh",
		weekday: "long",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(new Date());
	return (
		<header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-5 rounded-2xl bg-[#173f2b] px-5 py-5 text-white shadow-md sm:px-6">
			<div>
				<p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b5cfb7]">
					Khu vực chủ chuyến
				</p>
				<h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
					Tổng quan vận hành
				</h1>
				<p className="mt-2 text-sm text-[#c6d8c7]">Chào mừng trở lại, {name}</p>
			</div>
			<div className="flex flex-col gap-3 sm:items-end">
				<p className="flex items-center gap-2 text-xs capitalize text-[#c6d8c7]">
					<CalendarDays aria-hidden="true" className="size-3.5" />
					{date}
				</p>
				<div className="flex flex-wrap gap-2">
					{onCreateTrip && (
						<button
							type="button"
							onClick={onCreateTrip}
							className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#173f2b] transition hover:bg-[#edf4ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
						>
							<Plus aria-hidden="true" className="size-3.5" />
							Tạo chuyến đi
						</button>
					)}
				</div>
			</div>
		</header>
	);
}
