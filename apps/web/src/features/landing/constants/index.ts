import { Bot, CloudRain, Map as MapIcon, Radio, Search, WifiOff } from "lucide-react";

export const NAV_ITEMS = [
	{ label: "Trang chủ", href: "/" },
	{ label: "Khám phá", href: "/trekking" },
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

import type { DestinationCard } from "../types";

export const FEATURED_DESTINATIONS: DestinationCard[] = [
	{
		id: "dest-son-tra",
		title: "Bán đảo Sơn Trà & Đỉnh Bàn Cờ",
		location: "Sơn Trà, Đà Nẵng",
		zone: "Sơn Trà",
		price: "150.000 VNĐ",
		rating: 4.9,
		reviewCount: 142,
		weatherBadge: "Thời tiết: 24°C Nắng nhẹ",
		statusBadge: "Đường mở an toàn",
		difficulty: "Trung bình",
		duration: "3 - 4 giờ",
		distance: "8.5 km",
		elevation: "+696m",
		highlights: ["Đỉnh Bàn Cờ", "Voọc chà vá chân nâu", "Toàn cảnh vịnh biển"],
		image:
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_1.png",
		],
	},
	{
		id: "dest-hai-van",
		title: "Đèo Hải Vân & Hải Vân Quan",
		location: "Liên Chiểu, Đà Nẵng",
		zone: "Hải Vân",
		price: "250.000 VNĐ",
		rating: 4.8,
		reviewCount: 186,
		weatherBadge: "Thời tiết: 21°C Sương nhẹ",
		statusBadge: "Tầm nhìn tốt",
		difficulty: "Thử thách",
		duration: "4 - 5 giờ",
		distance: "12.0 km",
		elevation: "+496m",
		highlights: ["Hải Vân Quan", "Săn mây đỉnh đèo", "Cung chữ U ngoạn mục"],
		image:
			"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_2.png",
		],
	},
	{
		id: "dest-gieng-troi",
		title: "Suối Giếng Trời - Hòa Vang",
		location: "Hòa Vang, Đà Nẵng",
		zone: "Hòa Vang",
		price: "180.000 VNĐ",
		rating: 4.9,
		reviewCount: 98,
		weatherBadge: "Thời tiết: 23°C Râm mát",
		statusBadge: "Nước suối trong",
		difficulty: "Thử thách",
		duration: "5 - 6 giờ",
		distance: "10.2 km",
		elevation: "+350m",
		highlights: ["Thác nước tự nhiên", "Hồ nước ngọc bích", "Tắm suối nguyên sinh"],
		image:
			"https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_3.png",
		],
	},
	{
		id: "dest-hoa-trung",
		title: "Hồ Hòa Trung (Thảo nguyên xanh)",
		location: "Liên Chiểu, Đà Nẵng",
		zone: "Hòa Vang",
		price: "Miễn phí",
		rating: 4.7,
		reviewCount: 215,
		weatherBadge: "Thời tiết: 25°C Nắng dịu",
		statusBadge: "Đường khô ráo",
		difficulty: "Dễ",
		duration: "2 - 3 giờ",
		distance: "5.5 km",
		elevation: "+120m",
		highlights: ["Thảo nguyên cỏ xanh", "Cắm trại ven hồ", "Chèo thuyền Kayak"],
		image:
			"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_4.png",
		],
	},
	{
		id: "dest-ghenh-bang",
		title: "Ghềnh Bàng & Mũi Nghê",
		location: "Sơn Trà, Đà Nẵng",
		zone: "Sơn Trà",
		price: "Miễn phí",
		rating: 4.8,
		reviewCount: 112,
		weatherBadge: "Thời tiết: 26°C Sóng êm",
		statusBadge: "Thủy triều an toàn",
		difficulty: "Trung bình",
		duration: "3 - 4 giờ",
		distance: "6.0 km",
		elevation: "+180m",
		highlights: ["Bãi đá ghềnh tự nhiên", "Lặn ngắm san hô", "Đón bình minh sớm"],
		image:
			"https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_1.png",
		],
	},
	{
		id: "dest-ba-na",
		title: "Rừng nguyên sinh Bà Nà - Suối Mơ",
		location: "Hòa Vang, Đà Nẵng",
		zone: "Bà Nà",
		price: "350.000 VNĐ",
		rating: 4.8,
		reviewCount: 84,
		weatherBadge: "Thời tiết: 20°C Dịu mát",
		statusBadge: "Tuyến bảo tồn mở",
		difficulty: "Trung bình",
		duration: "3.5 - 4.5 giờ",
		distance: "7.8 km",
		elevation: "+540m",
		highlights: ["Rừng già nhiệt đới", "Suối đá trong vắt", "Không khí nguyên sinh"],
		image:
			"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
		images: [
			"https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=800&q=80",
			"https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=800&q=80",
			"/figma_assets/card_2.png",
		],
	},
];

export const MAIN_FEATURES = [
	{
		icon: Search,
		title: "Tìm kiếm thông minh",
		description: "Lọc tuyến trekking theo thời tiết, độ khó, vị trí và trạng thái vận hành.",
	},
	{
		icon: MapIcon,
		title: "Bản đồ tuyến trực quan",
		description: "Theo dõi hình học tuyến, checkpoint và khu vực nguy hiểm trên bản đồ.",
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
