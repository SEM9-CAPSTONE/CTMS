import { ArrowRight } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

const PHOTO_STORIES = [
	{
		image:
			"https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=900&q=80",
		fallback: "/figma_assets/card_1.png",
		tag: "Điểm đến chọn lọc",
		title: "Cắm trại và leo núi đúng chuẩn",
		caption: "Lịch trình, sức chứa và mức độ khó được công khai rõ ràng trước khi đặt chỗ.",
	},
	{
		image: "/figma_assets/safety_map.png",
		fallback: "/figma_assets/card_2.png",
		tag: "An toàn thực địa",
		title: "Bản đồ tuyến và cảnh báo thời tiết",
		caption: "Giám sát rủi ro thời tiết, mốc kiểm soát và vùng nguy hiểm theo từng khu vực.",
	},
	{
		image: "/figma_assets/mobile_app.png",
		fallback: "/figma_assets/card_3.png",
		tag: "Đồng hành di động",
		title: "Dẫn đường ổn định cả khi mất sóng",
		caption: "Tải trước bản đồ ngoại tuyến, điểm danh chặng và kết nối cứu hộ trên điện thoại.",
	},
];

const ROLES = [
	{
		title: "Người tham gia",
		description: "Xem chuyến đi công khai, đặt chỗ minh bạch và chủ động chuẩn bị an toàn.",
	},
	{
		title: "Đơn vị tổ chức",
		description: "Tạo tuyến, mở chuyến, điều phối người dẫn đường và theo dõi đối soát.",
	},
	{
		title: "Người dẫn đường",
		description: "Hồ sơ chứng chỉ được xác minh, đồng hành điểm danh và hỗ trợ thực địa.",
	},
	{
		title: "Quản trị viên",
		description: "Kiểm duyệt tuyến đường, ngưỡng thời tiết, hoàn tiền và tính minh bạch hệ thống.",
	},
];

export const AboutPage: React.FC<PublicPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	return (
		<PublicPageLayout
			eyebrow="Về CTMS"
			title="Nền tảng tổ chức cắm trại và leo núi an toàn"
			subtitle="Kết nối người tham gia, đơn vị tổ chức và người dẫn đường trên một quy trình minh bạch — từ tìm chuyến đi đến hoàn tất hành trình."
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
					<span>Khám phá chuyến đi</span>
					<ArrowRight className="ml-1.5 size-4" />
				</Button>
			}
		>
			{/* Visual Hero Feature */}
			<section className="overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-xs">
				<div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]">
					<div className="relative min-h-[260px] bg-[#163323] sm:min-h-[340px]">
						<img
							src="https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1400&q=80"
							alt="Cung đường núi rừng và hồ nước dã ngoại CTMS"
							className="h-full w-full object-cover"
							onError={(event) => {
								event.currentTarget.src = "/figma_assets/hero_image.png";
							}}
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-[#10221b]/75 via-transparent to-transparent" />
						<p className="absolute right-5 bottom-4 left-5 text-xs font-medium text-white/95">
							Đồng bộ hành trình giữa trang web lập kế hoạch và ứng dụng di động ngoài thực địa.
						</p>
					</div>

					<div className="flex flex-col justify-between p-6 sm:p-8">
						<div>
							<p className="text-xs font-semibold tracking-wide text-[#2d5a27]">
								Trải nghiệm trọn vẹn
							</p>
							<h2 className="mt-2 text-xl font-bold tracking-tight text-[#10221b] sm:text-2xl">
								Chuẩn bị nhẹ nhàng, vận hành rõ ràng
							</h2>
							<p className="mt-3 text-sm leading-relaxed text-[#425048]">
								CTMS tập trung toàn bộ lịch trình, điều kiện thời tiết, thiết bị cần mang và hỗ trợ
								khẩn cấp vào một nơi duy nhất để mỗi chuyến đi diễn ra suôn sẻ.
							</p>
						</div>

						<div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#eef2ee] pt-5">
							<div>
								<p className="text-xs font-medium text-[#667a6d]">Hệ sinh thái</p>
								<p className="mt-1 whitespace-nowrap text-lg font-bold text-[#10221b]">4 vai trò</p>
							</div>
							<div>
								<p className="text-xs font-medium text-[#667a6d]">Nền tảng</p>
								<p className="mt-1 whitespace-nowrap text-lg font-bold text-[#10221b]">
									Web &amp; Di động
								</p>
							</div>
							<div>
								<p className="text-xs font-medium text-[#667a6d]">Cảnh báo</p>
								<p className="mt-1 whitespace-nowrap text-lg font-bold text-[#10221b]">3 mức độ</p>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Photo Gallery Story Strip */}
			<section className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
				{PHOTO_STORIES.map((story) => (
					<article
						key={story.title}
						className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs"
					>
						<div className="h-52 w-full overflow-hidden bg-[#10221b]">
							<img
								src={story.image}
								alt={story.title}
								className="h-full w-full object-cover transition duration-300 hover:scale-105"
								onError={(event) => {
									event.currentTarget.src = story.fallback;
								}}
							/>
						</div>
						<div className="p-5">
							<p className="text-xs font-semibold text-[#2d5a27]">{story.tag}</p>
							<h3 className="mt-1 text-base font-bold text-[#10221b]">{story.title}</h3>
							<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">{story.caption}</p>
						</div>
					</article>
				))}
			</section>

			{/* Compact 4-Role Strip */}
			<section className="mt-6 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs">
				<h2 className="text-base font-bold text-[#10221b]">Bốn vai trò phối hợp trong CTMS</h2>
				<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{ROLES.map((item) => (
						<div key={item.title} className="border-t border-[#eef2ee] pt-3">
							<h3 className="text-sm font-bold text-[#164027]">{item.title}</h3>
							<p className="mt-1 text-xs leading-relaxed text-[#425048]">{item.description}</p>
						</div>
					))}
				</div>
			</section>

			{/* Clean Bottom CTA */}
			<section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:flex-row sm:items-center">
				<div>
					<h2 className="text-base font-bold text-[#10221b]">Bắt đầu hành trình cùng CTMS</h2>
					<p className="mt-1 text-xs text-[#425048]">
						Xem trước toàn bộ chuyến đi đang mở, chỉ cần đăng nhập hoặc đăng ký khi đặt chỗ.
					</p>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/trips")}>
						Xem chuyến đi
					</Button>
					<Button
						variant="primary"
						size="sm"
						onClick={onNavigateToRegister}
						className="bg-[#164027] hover:bg-[#0f2e1c]"
					>
						Đăng ký tài khoản
					</Button>
				</div>
			</section>
		</PublicPageLayout>
	);
};
