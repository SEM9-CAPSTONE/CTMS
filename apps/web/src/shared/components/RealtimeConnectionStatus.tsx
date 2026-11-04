import { StatusBadge, type StatusBadgeTone } from "./StatusBadge";

/** Connection states shown to the user (CTMS-078-T02); `recovered`/`unauthorized` are feature-level. */
export type RealtimeDisplayState =
	| "connecting"
	| "connected"
	| "reconnecting"
	| "disconnected"
	| "auth_rejected"
	| "recovered"
	| "unauthorized";

const TONES: Record<RealtimeDisplayState, StatusBadgeTone> = {
	connecting: "neutral",
	connected: "success",
	reconnecting: "warning",
	disconnected: "warning",
	auth_rejected: "danger",
	recovered: "info",
	unauthorized: "warning",
};

export const DEFAULT_REALTIME_LABELS: Record<RealtimeDisplayState, string> = {
	connecting: "Đang kết nối thời gian thực…",
	connected: "Đang nhận cập nhật thời gian thực",
	reconnecting: "Mất kết nối — đang kết nối lại…",
	disconnected: "Mất kết nối thời gian thực — dữ liệu vẫn tự cập nhật định kỳ",
	auth_rejected: "Phiên đăng nhập hết hạn — đang khôi phục phiên…",
	recovered: "Đã kết nối lại — đã tải lại dữ liệu có thể bị lỡ",
	unauthorized: "Không có quyền nhận cập nhật thời gian thực cho mục này",
};

export interface RealtimeConnectionStatusProps {
	state: RealtimeDisplayState | null;
	labels?: Partial<Record<RealtimeDisplayState, string>>;
	testId?: string;
}

/** Tells the user whether updates arrive in real time or only through periodic refresh. */
export function RealtimeConnectionStatus({
	state,
	labels,
	testId = "realtime-connection-status",
}: RealtimeConnectionStatusProps) {
	if (!state) return null;
	return (
		<output data-testid={testId} data-state={state} aria-live="polite">
			<StatusBadge tone={TONES[state]}>
				{labels?.[state] ?? DEFAULT_REALTIME_LABELS[state]}
			</StatusBadge>
		</output>
	);
}
