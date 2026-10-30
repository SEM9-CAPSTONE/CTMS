import type { RouteDifficulty, RouteStatus } from "../types";

export const difficultyLabels: Record<RouteDifficulty, string> = {
	easy: "Dễ",
	moderate: "Trung bình",
	hard: "Khó",
	expert: "Chuyên gia",
};
export const statusLabels: Record<RouteStatus, string> = {
	draft: "Nháp",
	pending_approval: "Chờ duyệt",
	active: "Đang hoạt động",
	closed: "Đã đóng",
};
export function formatLength(lengthMeters: number): string {
	return lengthMeters >= 1000
		? `${(lengthMeters / 1000).toFixed(2)} km`
		: `${Math.round(lengthMeters)} m`;
}
export function formatCreatedAt(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "2-digit",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
}
