import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import type { SosRealtimeState } from "../hooks/useHostSosRealtime";
import { useSosRealtimeState } from "./HostSosRealtimeProvider";

const STATUS_VIEW: Record<SosRealtimeState, { tone: StatusBadgeTone; label: string }> = {
	connecting: { tone: "neutral", label: "Đang kết nối cảnh báo SOS…" },
	live: { tone: "success", label: "Đang nhận cảnh báo SOS theo thời gian thực" },
	disconnected: {
		tone: "warning",
		label: "Mất kết nối thời gian thực — đang thử lại, danh sách vẫn tự cập nhật định kỳ",
	},
	recovered: { tone: "info", label: "Đã kết nối lại — đã tải lại các SOS có thể bị lỡ" },
};

/** CTMS-079-T02: tells the Host whether SOS arrive in real time or only through periodic refresh. */
export function SosRealtimeStatus() {
	const state = useSosRealtimeState();
	if (!state) return null;
	const view = STATUS_VIEW[state];
	return (
		<output data-testid="sos-realtime-status" data-state={state} aria-live="polite">
			<StatusBadge tone={view.tone}>{view.label}</StatusBadge>
		</output>
	);
}
