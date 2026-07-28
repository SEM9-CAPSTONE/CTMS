import { Bot, CloudRain, Map as MapIcon, Radio, Search, WifiOff } from "lucide-react";

export const NAV_ITEMS = [
	{ label: "Trang chủ", href: "/" },
	{ label: "Khám phá", href: "/campsites" },
	{ label: "Trekking", href: "/trekking" },
	{ label: "An toàn", href: "/safety" },
	{ label: "Giới thiệu", href: "/about" },
];

export const HERO_BADGES = [
	{ icon: WifiOff, label: "Bản đồ Ngoại tuyến" },
	{ icon: Radio, label: "GPS chính xác" },
	{ icon: CloudRain, label: "Thời tiết thực" },
	{ icon: Bot, label: "Trợ lý AI" },
];

export const FEATURED_DESTINATIONS = [
	{
		title: "Sơn Đào Trà",
		location: "Sơn Trà, Đà Nẵng",
		price: "150.000 VNĐ / đêm",
		rating: 4.9,
		weatherBadge: "Thời tiết: Tốt",
		statusBadge: "Đường mở",
		image: "/figma_assets/card_1.png",
	},
	{
		title: "Vườn Quốc Gia Bà Nà",
		location: "Hòa Vang, Đà Nẵng",
		price: "450.000 VNĐ",
		rating: 4.8,
		weatherBadge: "Gió cường độ nhẹ",
		statusBadge: "Thời tiết tốt",
		image: "/figma_assets/card_2.png",
	},
	{
		title: "Vân Sơn",
		location: "Lâm Đồng, Việt Nam",
		price: "350.000 VNĐ",
		rating: 4.7,
		weatherBadge: "Thời tiết: Lý tưởng",
		statusBadge: "Thời tiết mát mẻ",
		image: "/figma_assets/card_3.png",
	},
	{
		title: "Hồ Hòa Trung",
		location: "Liên Chiểu, Đà Nẵng",
		price: "Miễn phí",
		rating: 4.6,
		weatherBadge: "Thời tiết: Mát mẻ",
		statusBadge: "Bãi cắm mở",
		image: "/figma_assets/card_4.png",
	},
];

export const MAIN_FEATURES = [
	{
		icon: Search,
		title: "Tìm kiếm thông minh",
		description: "Lọc địa điểm theo thời tiết, độ khó, vị trí và các tiện ích thực tế có sẵn.",
	},
	{
		icon: MapIcon,
		title: "Sơ đồ lều trực quan",
		description: "Bản đồ 2D/3D bãi cắm, bố trí vị trí lều và các khu vực dịch vụ dễ dàng.",
	},
	{
		icon: WifiOff,
		title: "Bản đồ Ngoại tuyến (Offline)",
		description: "Tải bản đồ địa hình và lộ trình để sử dụng ngay cả khi không có sóng di động.",
	},
	{
		icon: Radio,
		title: "GPS & Cảnh báo cứu hộ",
		description: "Tích hợp tọa độ khẩn cấp, giúp quản lý tìm thấy bạn nhanh nhất khi có sự cố.",
	},
	{
		icon: CloudRain,
		title: "Cảnh báo thời tiết",
		description:
			"Thông báo thời tiết và dự báo thời tiết nguy hiểm (mưa lớn, sạt lở, giông lốc...).",
	},
	{
		icon: Bot,
		title: "Trợ lý Sinh tồn AI",
		description: "Trợ lý AI hướng dẫn sơ cứu khẩn cấp, xử lý vết thương và xử lý khi lạc đường.",
	},
];

export const SAFETY_CHECKLIST = [
	"Tự động gửi thông báo SOS khi mất kết nối quá lâu trên lộ trình",
	"Hướng dẫn xử lý sự cố khẩn cấp ngoại tuyến khi mất sóng",
	"Kết nối trực tiếp với đội cứu hộ địa phương",
	"Cảnh báo thời tiết giông lốc, nguy hiểm kịp thời",
	"Ghi lại vị trí nhóm theo thời gian thực",
];

export const AI_PROMPTS = [
	"“Tôi bị lạc rừng, nên làm gì đầu tiên?”",
	"“Bị rắn cắn gần nhất cần sơ cứu thế nào?”",
	"“Cách xử lý khi giông sét đột ngột?”",
];
