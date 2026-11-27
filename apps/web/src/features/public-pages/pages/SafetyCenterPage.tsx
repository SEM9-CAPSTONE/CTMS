import {
	AlertTriangle,
	ArrowRight,
	CloudRain,
	HeartPulse,
	MapPin,
	Radio,
	ShieldCheck,
	WifiOff,
} from "lucide-react";
import type React from "react";
import { Button, StatusBadge } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

const WEATHER_LEVELS = [
	{
		level: "Mức Xanh",
		tone: "success" as const,
		title: "Điều kiện thuận lợi",
		description:
			"Thời tiết ổn định, các chuyến đi mở đăng ký và khởi hành theo lịch trình đã công bố cùng các điểm kiểm soát định kỳ.",
	},
	{
		level: "Mức Vàng",
		tone: "warning" as const,
		title: "Cảnh báo thận trọng",
		description:
			"Có dấu hiệu mưa, gió mạnh hoặc tầm nhìn giảm. Hệ thống hiển thị cảnh báo cho người tham gia và đơn vị tổ chức để chuẩn bị trang bị phù hợp.",
	},
	{
		level: "Mức Đỏ",
		tone: "danger" as const,
		title: "Nguy cơ cao — Hạn chế vận hành",
		description:
			"Khi vượt ngưỡng nguy hiểm đã cấu hình, hệ thống chặn đặt chỗ mới và hỗ trợ quy trình can thiệp, hoãn hoặc hủy chuyến vì thời tiết.",
	},
];

const SAFETY_PILLARS = [
	{
		icon: CloudRain,
		title: "Đánh giá rủi ro thời tiết theo khu vực",
		body: "DiTrek tự động đối chiếu dữ liệu dự báo thời tiết với bộ quy tắc an toàn của từng khu vực dã ngoại trước ngày khởi hành và trong suốt chuyến đi.",
	},
	{
		icon: MapPin,
		title: "Điểm kiểm soát và vùng nguy hiểm đã xác minh",
		body: "Tuyến đường được gắn mốc kiểm soát và vùng cảnh báo đã qua kiểm duyệt của quản trị viên, giúp người tham gia nắm rõ vị trí cần lưu ý.",
	},
	{
		icon: WifiOff,
		title: "Bản đồ ngoại tuyến trên ứng dụng di động",
		body: "Người tham gia có thể tải trước gói bản đồ địa hình và lộ trình chuyến đi để tiếp tục tra cứu khi đi vào vùng không có sóng di động.",
	},
	{
		icon: Radio,
		title: "Tín hiệu cầu cứu và điều phối khẩn cấp",
		body: "Khi phát sinh sự cố, người tham gia có thể gửi cảnh báo khẩn cấp kèm tọa độ gần nhất tới đơn vị tổ chức và người dẫn đường phụ trách chuyến.",
	},
	{
		icon: ShieldCheck,
		title: "Trợ lý sinh tồn hỗ trợ tham khảo kỹ năng",
		body: "Cung cấp hướng dẫn tham khảo nhanh về xử lý thời tiết xấu, giữ ấm, tìm hướng và sơ cứu cơ bản ngay trên giao diện ứng dụng.",
	},
	{
		icon: HeartPulse,
		title: "Chia sẻ Hồ sơ sức khỏe tùy chọn khi đặt chỗ",
		body: "Người tham gia chủ động quyết định có chia sẻ thông tin dị ứng, tiền sử bệnh và liên hệ khẩn cấp cho đơn vị tổ chức và người dẫn đường hay không.",
	},
];

export const SafetyCenterPage: React.FC<PublicPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	return (
		<PublicPageLayout
			eyebrow="Trung tâm an toàn dã ngoại"
			title="Hệ thống bảo vệ nhiều lớp trên mọi hành trình DiTrek"
			subtitle="Từ khâu kiểm tra thời tiết trước khi đặt chỗ, quản lý vùng nguy hiểm trên bản đồ cho đến phối hợp xử lý tình huống khẩn cấp cùng đơn vị tổ chức và người dẫn đường."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button
					variant="primary"
					size="sm"
					onClick={() => onNavigateToPath("/trips")}
					className="bg-[#164027] hover:bg-[#0f2e1c]"
				>
					<span>Tìm chuyến đi an toàn</span>
					<ArrowRight className="ml-1.5 size-4" />
				</Button>
			}
		>
			{/* Weather Risk Tiers */}
			<section className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:p-8">
				<h2 className="text-lg font-semibold text-[#10221b]">Phân cấp cảnh báo rủi ro thời tiết</h2>
				<p className="mt-1.5 text-sm leading-relaxed text-[#425048]">
					Mỗi chuyến đi trên DiTrek được giám sát theo ba mức cảnh báo thời tiết để người tham gia
					và đơn vị tổ chức đưa ra quyết định kịp thời.
				</p>

				<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
					{WEATHER_LEVELS.map((tier) => (
						<div key={tier.level} className="rounded-2xl border border-[#e6eee7] bg-[#f9fbf9] p-5">
							<StatusBadge tone={tier.tone}>{tier.level}</StatusBadge>
							<h3 className="mt-3 text-base font-bold text-[#10221b]">{tier.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-[#425048]">{tier.description}</p>
						</div>
					))}
				</div>
			</section>

			{/* 6 Safety Pillars */}
			<section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{SAFETY_PILLARS.map((pillar) => {
					const Icon = pillar.icon;
					return (
						<article
							key={pillar.title}
							className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs"
						>
							<div className="flex size-10 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
								<Icon className="size-5" />
							</div>
							<h3 className="mt-4 text-base font-bold text-[#10221b]">{pillar.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-[#425048]">{pillar.body}</p>
						</article>
					);
				})}
			</section>

			{/* Important Disclaimer */}
			<section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
				<div className="flex items-start gap-3">
					<AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700" />
					<div className="space-y-2">
						<h2 className="text-base font-bold text-amber-950">
							Lưu ý quan trọng về giới hạn hỗ trợ kỹ thuật
						</h2>
						<p className="text-sm leading-relaxed text-amber-900">
							Tính năng gửi tín hiệu cầu cứu khẩn cấp phụ thuộc vào tình trạng pin, thiết bị, tín
							hiệu định vị và kết nối mạng tại thời điểm sử dụng. Các phản hồi từ Trợ lý sinh tồn
							chỉ mang tính tham khảo, không thay thế hướng dẫn y tế chuyên môn hoặc lực lượng cứu
							hộ công lập như 113, 114, 115.
						</p>
						<div className="flex flex-wrap gap-3 pt-1">
							<Button
								variant="outline"
								size="sm"
								onClick={() => onNavigateToPath("/terms-and-policy")}
							>
								Đọc Điều khoản và Chính sách
							</Button>
							<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/mobile-app")}>
								Xem ứng dụng di động DiTrek
							</Button>
						</div>
					</div>
				</div>
			</section>
		</PublicPageLayout>
	);
};
