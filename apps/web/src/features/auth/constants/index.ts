import type { RoleOption } from "../types";

export const AUTH_MESSAGES = {
	TITLE: "Chào mừng trở lại",
	SUBTITLE: "Đăng nhập để tiếp tục hành trình của bạn.",
	IDENTIFIER_LABEL: "Email hoặc số điện thoại",
	IDENTIFIER_PLACEHOLDER: "your@email.com hoặc 09xxxxxxxx",
	PASSWORD_LABEL: "Mật khẩu",
	REMEMBER_ME: "Ghi nhớ",
	FORGOT_PASSWORD: "Quên mật khẩu?",
	SUBMIT_BUTTON: "Đăng nhập",
	REGISTER_BUTTON: "Đăng ký tài khoản mới",
	SOCIAL_DIVIDER: "Hoặc đăng nhập bằng",
	GOOGLE_BUTTON: "Đăng nhập bằng Google",
	NO_ACCOUNT_PROMPT: "Bạn chưa có tài khoản?",
	REGISTER_NOW: "Đăng ký ngay",
	BACK_TO_HOME: "Quay về trang chủ",
};

export const AUTH_HERO_BADGES = [
	{ label: "Offline Maps" },
	{ label: "Weather Risk" },
	{ label: "AI Analytics" },
	{ label: "GPS Tracking" },
];

// Step 3 ("Xác minh OTP") is rendered on RegisterPage's stepper for context,
// but is completed on VerifyOtpPage after navigating away — RegisterPage
// itself never reaches currentStep 3.
export const REGISTER_STEPS = [
	{ step: 1, label: "Chọn vai trò" },
	{ step: 2, label: "Nhập thông tin" },
	{ step: 3, label: "Xác minh OTP" },
];

export const ROLE_OPTIONS: RoleOption[] = [
	{
		id: "camper",
		title: "Camper (Khách cắm trại)",
		description: "Yêu thiên nhiên, muốn khám phá bãi cắm trại và trải nghiệm các chuyến trekking.",
		features: ["Đặt bãi cắm trại & tour trekking", "Xem bản đồ offline & an toàn thời tiết"],
	},
	{
		id: "host",
		title: "Host (Chủ bãi trại)",
		badge: {
			text: "XÉT DUYỆT BÃI TRẠI",
			variant: "orange",
		},
		description: "Cung cấp và quản lý dịch vụ lưu trú, bãi cắm trại chuyên nghiệp.",
		features: [
			"Đăng bán bãi cắm trại & quản lý sơ đồ",
			"Hệ thống quản lý đặt chỗ & thiết bị (PMS)",
		],
	},
	{
		id: "porter",
		title: "Porter (Người dẫn đường)",
		badge: {
			text: "CẦN XÁC MINH/CHỨNG CHỈ",
			variant: "green",
		},
		description: "Người dẫn đường chuyên nghiệp, hỗ trợ vận chuyển trang thiết bị leo núi.",
		features: ["Nhận dẫn đoàn & hỗ trợ vận chuyển", "Cập nhật chứng chỉ hành nghề trekking"],
	},
];
