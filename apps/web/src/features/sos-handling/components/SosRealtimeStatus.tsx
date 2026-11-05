import {
	RealtimeConnectionStatus,
	type RealtimeDisplayState,
} from "../../../shared/components/RealtimeConnectionStatus";
import type { SosRealtimeState } from "../hooks/useHostSosRealtime";
import { useSosRealtimeState } from "./HostSosRealtimeProvider";

const DISPLAY_STATE: Record<SosRealtimeState, RealtimeDisplayState> = {
	connecting: "connecting",
	live: "connected",
	reconnecting: "reconnecting",
	disconnected: "disconnected",
	auth_rejected: "auth_rejected",
	recovered: "recovered",
};

const SOS_LABELS: Partial<Record<RealtimeDisplayState, string>> = {
	connecting: "Đang kết nối cảnh báo SOS…",
	connected: "Đang nhận cảnh báo SOS theo thời gian thực",
	disconnected: "Mất kết nối thời gian thực — đang thử lại, danh sách vẫn tự cập nhật định kỳ",
	recovered: "Đã kết nối lại — đã tải lại các SOS có thể bị lỡ",
};

/** CTMS-079-T02 / CTMS-078-T02: tells the Host whether SOS arrive in real time or only by refresh. */
export function SosRealtimeStatus() {
	const state = useSosRealtimeState();
	if (!state) return null;
	return (
		<RealtimeConnectionStatus
			state={DISPLAY_STATE[state]}
			labels={SOS_LABELS}
			testId="sos-realtime-status"
		/>
	);
}
