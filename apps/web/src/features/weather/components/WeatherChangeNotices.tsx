import { CloudSun, X } from "lucide-react";
import { useRef } from "react";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import { useWeatherDecisionAlerts } from "../../weather-decisions/hooks/useWeatherDecisions";
import type { weatherDecisionsService } from "../../weather-decisions/services/weather-decisions.service";
import {
	WEATHER_URGENCY_LABELS,
	WEATHER_URGENCY_TONES,
} from "../../weather-decisions/utils/weather-decision-labels";
import { useWeatherChangeNotices } from "../hooks/useWeatherChangeNotices";
import { WEATHER_RISK_LABELS, WEATHER_RISK_TONES } from "../utils/weather-risk";

type Options = NonNullable<Parameters<typeof useWeatherChangeNotices>[0]> & {
	/** Forecast level changes (Host, Camper). */
	includeChanges?: boolean;
	/** Decision reminders near departure (Host, Admin; CTMS-60). */
	includeDecisions?: boolean;
	decisionService?: typeof weatherDecisionsService;
};

/**
 * CTMS-93 monitoring, policy §4: Host and Camper inbox of forecast level changes for their Trips.
 * Same look as the booking cancellation notices button next to it.
 */
export function WeatherChangeNotices({
	includeChanges = true,
	includeDecisions = false,
	decisionService,
	...options
}: Options = {}) {
	const dialog = useRef<HTMLDialogElement>(null);
	const {
		query,
		markRead,
		unread: changesUnread,
	} = useWeatherChangeNotices({
		...options,
		enabled: includeChanges,
	});
	const alerts = useWeatherDecisionAlerts({
		enabled: includeDecisions,
		connection: options.connection,
		service: decisionService,
	});
	const unread = (includeChanges ? changesUnread : 0) + (includeDecisions ? alerts.unread : 0);
	const items = query.data?.items;
	const alertItems = alerts.query.data?.items;
	// Admins handle reminders from the intervention page; Hosts from the Trip page.
	const alertHref = (tripId: string) => (includeChanges ? `/trips/${tripId}` : "/admin/weather");
	return (
		<>
			<button
				type="button"
				aria-label={`Thông báo thời tiết (${unread} chưa đọc)`}
				title="Thông báo thời tiết"
				onClick={() => dialog.current?.showModal()}
				className="relative shrink-0 rounded-full p-2 text-[#164027] hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-700"
			>
				<CloudSun className="size-5" />
				{unread > 0 && (
					<span className="absolute -right-1 -top-1 rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
						{unread}
					</span>
				)}
			</button>
			<dialog
				ref={dialog}
				aria-label="Thông báo thời tiết"
				className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 text-sm text-[#10221b] shadow-xl backdrop:bg-black/40"
			>
				<div className="flex items-center justify-between gap-3">
					<h2 className="font-bold">Thông báo thời tiết ({unread} chưa đọc)</h2>
					<button
						type="button"
						aria-label="Đóng thông báo thời tiết"
						onClick={() => dialog.current?.close()}
						className="rounded-full p-2 hover:bg-emerald-50"
					>
						<X className="size-5" />
					</button>
				</div>
				{includeDecisions && (
					<section aria-label="Cần quyết định" className="mt-3">
						<h3 className="text-xs font-extrabold uppercase text-rose-800">Cần quyết định</h3>
						{alerts.query.isLoading && <p className="mt-2">Đang tải lời nhắc...</p>}
						{alerts.query.isError && (
							<button
								type="button"
								onClick={() => void alerts.query.refetch()}
								className="mt-2 underline"
							>
								Không tải được lời nhắc. Thử lại
							</button>
						)}
						{alertItems?.length === 0 && <p className="mt-2">Không có lời nhắc nào.</p>}
						{alerts.markRead.isError && (
							<p role="alert">Không thể đánh dấu đã đọc. Vui lòng thử lại.</p>
						)}
						<ul className="mt-2 max-h-60 space-y-3 overflow-y-auto" aria-live="polite">
							{alertItems?.map((alert) => (
								<li
									key={alert.id}
									data-testid="weather-decision-alert"
									data-urgency={alert.urgency}
									className="rounded-lg bg-rose-50 p-3"
								>
									<div className="flex flex-wrap items-center gap-2">
										<a className="font-bold underline" href={alertHref(alert.tripId)}>
											{alert.tripTitle}
										</a>
										<StatusBadge tone={WEATHER_URGENCY_TONES[alert.urgency]}>
											{WEATHER_URGENCY_LABELS[alert.urgency]}
										</StatusBadge>
									</div>
									<p className="mt-1">{alert.message}</p>
									{!alert.readAt && (
										<button
											type="button"
											disabled={alerts.markRead.isPending}
											onClick={() => alerts.markRead.mutate(alert.id)}
											className="mt-2 text-xs font-bold underline"
										>
											Đánh dấu đã đọc
										</button>
									)}
									<p className="mt-1 text-xs text-slate-600">
										{new Date(alert.createdAt).toLocaleString("vi-VN")}
									</p>
								</li>
							))}
						</ul>
					</section>
				)}
				{includeChanges && includeDecisions && (
					<h3 className="mt-4 text-xs font-extrabold uppercase text-[#164027]">Thay đổi dự báo</h3>
				)}
				{includeChanges && query.isLoading && <p className="mt-3">Đang tải thông báo...</p>}
				{includeChanges && query.isError && (
					<button type="button" onClick={() => void query.refetch()} className="mt-3 underline">
						Không tải được thông báo. Thử lại
					</button>
				)}
				{includeChanges && items?.length === 0 && (
					<p className="mt-3">Chưa có thông báo thay đổi thời tiết.</p>
				)}
				{markRead.isError && <p role="alert">Không thể đánh dấu đã đọc. Vui lòng thử lại.</p>}
				<ul className="mt-3 max-h-80 space-y-3 overflow-y-auto" aria-live="polite">
					{items?.map((notice) => (
						<li
							key={notice.id}
							data-testid="weather-change-notice"
							data-worsened={notice.worsened}
							className={`rounded-lg p-3 ${notice.worsened ? "bg-amber-50" : "bg-emerald-50"}`}
						>
							<a className="font-bold underline" href={`/trips/${notice.tripId}`}>
								{notice.tripTitle}
							</a>
							<p className="mt-1">{notice.message}</p>
							<div className="mt-2 flex flex-wrap items-center gap-2">
								<StatusBadge tone={WEATHER_RISK_TONES[notice.previousRiskLevel]}>
									{WEATHER_RISK_LABELS[notice.previousRiskLevel]}
								</StatusBadge>
								<span aria-hidden="true">→</span>
								<StatusBadge tone={WEATHER_RISK_TONES[notice.riskLevel]}>
									{WEATHER_RISK_LABELS[notice.riskLevel]}
								</StatusBadge>
							</div>
							{!notice.readAt && (
								<button
									type="button"
									disabled={markRead.isPending}
									onClick={() => markRead.mutate(notice.id)}
									className="mt-2 text-xs font-bold underline"
								>
									Đánh dấu đã đọc
								</button>
							)}
							<p className="mt-1 text-xs text-slate-600">
								{new Date(notice.createdAt).toLocaleString("vi-VN")}
							</p>
						</li>
					))}
				</ul>
				<p className="mt-2 text-xs text-slate-500">
					50 thông báo gần nhất · Cập nhật ngay khi có thay đổi
				</p>
			</dialog>
		</>
	);
}
