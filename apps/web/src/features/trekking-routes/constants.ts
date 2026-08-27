import type { RouteLifecycleAction, RouteStatus } from "./types";

export interface RouteStatusActionContent {
	trigger: string;
	title: string;
	description: string;
	submit: string;
	pending: string;
}

export const ROUTE_STATUS_ACTION_CONTENT: Record<RouteLifecycleAction, RouteStatusActionContent> = {
	close: {
		trigger: "Đóng tuyến đường",
		title: "Xác nhận đóng tuyến đường",
		description:
			"Tuyến đường sẽ ngừng đủ điều kiện cho các Trip mới cho đến khi được mở lại và duyệt.",
		submit: "Đóng tuyến đường",
		pending: "Đang đóng...",
	},
	reopen: {
		trigger: "Mở lại tuyến đường",
		title: "Gửi tuyến đường để duyệt lại",
		description:
			"Tuyến đường sẽ chuyển sang trạng thái chờ duyệt, không tự động hoạt động trở lại.",
		submit: "Mở lại tuyến đường",
		pending: "Đang mở lại...",
	},
};

export function lifecycleActionForStatus(status: RouteStatus): RouteLifecycleAction | null {
	if (status === "active") return "close";
	if (status === "closed") return "reopen";
	return null;
}
