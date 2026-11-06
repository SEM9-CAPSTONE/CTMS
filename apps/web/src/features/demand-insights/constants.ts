import type { Difficulty, TripType } from "./types";
export const tripLabels: Record<TripType, string> = {
	day_trip: "Trong ngày",
	overnight: "Qua đêm",
};
export const difficultyLabels: Record<Difficulty, string> = {
	easy: "Dễ",
	moderate: "Trung bình",
	hard: "Khó",
	expert: "Chuyên sâu",
};
export const reasonLabels = {
	observed_booking_interest:
		"Bạn có thể cân nhắc tổ chức loại chuyến này vì đã có người đặt trong tháng được chọn.",
	advisory_not_forecast:
		"Bạn có thể tham khảo loại chuyến này khi lên kế hoạch. Gợi ý không đảm bảo sẽ có người đặt trong tương lai.",
};
export const panelClass = "rounded-2xl border border-[#dfe8df] bg-white p-5";
export const buttonClass =
	"inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027]";
export const activeStatus = (status?: string) => status === "pending" || status === "running";
export const formatDate = (value: string) =>
	new Intl.DateTimeFormat("vi-VN", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Asia/Ho_Chi_Minh",
	}).format(new Date(value));
export const monthLabel = (month: string) => `Tháng ${month.slice(5)}/${month.slice(0, 4)}`;
export const reportStamp = (value: string) => {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Asia/Ho_Chi_Minh",
		hour: "2-digit",
		minute: "2-digit",
		day: "numeric",
		month: "numeric",
		year: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date(value));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((item) => item.type === type)?.value ?? "";
	return `${part("hour")}:${part("minute")} ${Number(part("day"))}/${Number(part("month"))}/${part("year")}`;
};
