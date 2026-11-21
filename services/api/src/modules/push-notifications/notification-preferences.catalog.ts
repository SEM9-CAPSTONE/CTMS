import { PushCategory } from "./push-notifications.types";

/** Shared catalog for persistence validation, delivery and CTMS-386 rendering. */
export const NOTIFICATION_PREFERENCE_CATALOG = [
	{ category: PushCategory.BOOKING, configurable: true, label: "Đặt chỗ" },
	{ category: PushCategory.PORTER_ASSIGNMENT, configurable: true, label: "Phân công người hỗ trợ" },
	{
		category: PushCategory.WEATHER,
		configurable: true,
		label: "Thời tiết",
		mandatoryOverride: "red_weather",
	},
	{ category: PushCategory.SOS, configurable: false, label: "Cứu trợ khẩn cấp" },
	{ category: PushCategory.EMERGENCY, configurable: false, label: "Cảnh báo khẩn của chuyến" },
] as const;
