import { Megaphone, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { emergencyAlertTypeLabel, formatBroadcastTime } from "../constants";
import {
	type EmergencyBroadcastInbox,
	emergencyBroadcastInbox,
} from "../store/emergencyBroadcastInbox";

/**
 * CTMS-081-T02: urgent banner for each emergency alert a signed-in Camper/Porter received on this
 * page. Stays until the viewer marks it read; announced to assistive technology as an alert.
 */
export function EmergencyBroadcastAlerts({
	inbox = emergencyBroadcastInbox,
}: {
	inbox?: EmergencyBroadcastInbox;
}) {
	const alerts = useSyncExternalStore(inbox.subscribe, inbox.getSnapshot);
	if (alerts.length === 0) return null;

	return (
		<div
			data-testid="emergency-broadcast-alerts"
			className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4"
		>
			{alerts.map((alert) => (
				<section
					key={alert.eventId}
					role="alert"
					aria-label="Cảnh báo khẩn từ Host"
					data-testid="emergency-broadcast-alert"
					className="pointer-events-auto w-full max-w-xl rounded-2xl border border-red-300 bg-red-50 p-4 shadow-xl"
				>
					<div className="flex items-start gap-3">
						<div className="shrink-0 rounded-xl bg-red-100 p-2 text-red-600">
							<Megaphone aria-hidden="true" className="size-5" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex flex-wrap items-center gap-2">
								<span className="rounded-full border border-red-200 bg-white px-2 py-0.5 text-[11px] font-bold text-red-700">
									{emergencyAlertTypeLabel(alert.alertType)}
								</span>
								<h2 className="text-sm font-bold text-red-950">Cảnh báo khẩn từ Host</h2>
							</div>
							<p className="mt-1 text-xs text-red-700">
								{alert.tripTitle || "Chuyến đi của bạn"} · {formatBroadcastTime(alert.createdAt)}
							</p>
							<p className="mt-2 whitespace-pre-line text-sm font-medium text-red-950">
								{alert.content}
							</p>
						</div>
						<button
							type="button"
							onClick={() => inbox.dismiss(alert.eventId)}
							aria-label="Đóng cảnh báo"
							className="shrink-0 rounded-lg p-1 text-red-400 transition hover:text-red-700"
						>
							<X aria-hidden="true" className="size-4" />
						</button>
					</div>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={() => inbox.dismiss(alert.eventId)}
							className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
						>
							Đã đọc
						</button>
					</div>
				</section>
			))}
		</div>
	);
}
