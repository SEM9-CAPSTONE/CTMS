import { ArrowRight, Bot, CheckCircle2, Compass, Radio, Smartphone, WifiOff } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button, StatusBadge } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

type MobilePlatform = "android" | "ios";

export interface MobileAppPageProps extends PublicPageProps {
	initialPlatform?: MobilePlatform;
}

const MOBILE_CAPABILITIES = [
	{
		icon: WifiOff,
		title: "Tải bản đồ khu vực dùng ngoại tuyến",
		description:
			"Lưu sẵn bản đồ địa hình, đường mòn và các mốc kiểm soát trước chuyến đi để xem khi vào vùng không có sóng.",
	},
	{
		icon: Compass,
		title: "Theo dõi lộ trình và điểm danh chặng",
		description:
			"Hiển thị vị trí hiện tại trên tuyến, hỗ trợ người dẫn đường điểm danh và theo sát tiến độ đoàn.",
	},
	{
		icon: Bot,
		title: "Trợ lý sinh tồn hỗ trợ kỹ năng thực địa",
		description:
			"Tra cứu nhanh hướng dẫn ứng phó thời tiết xấu, giữ ấm, xác định phương hướng và sơ cứu cơ bản.",
	},
	{
		icon: Radio,
		title: "Gửi tín hiệu cầu cứu khẩn cấp",
		description:
			"Gửi cảnh báo khẩn cấp kèm tọa độ gần nhất tới đơn vị tổ chức và người dẫn đường phụ trách chuyến.",
	},
];

const PLATFORM_DETAILS: Record<
	MobilePlatform,
	{
		label: string;
		storeName: string;
		requirement: string;
		steps: string[];
	}
> = {
	android: {
		label: "Android",
		storeName: "Google Play",
		requirement:
			"Yêu cầu Android 9.0 trở lên, hỗ trợ định vị vệ tinh và dung lượng trống tối thiểu 200 MB cho bản đồ ngoại tuyến.",
		steps: [
			"Đăng ký hoặc đăng nhập tài khoản CTMS để đồng bộ danh sách chuyến đi đã đặt.",
			"Mở ứng dụng CTMS trên thiết bị Android và cho phép quyền vị trí cùng thông báo.",
			"Tải gói bản đồ khu vực chuyến đi khi có kết nối mạng trước giờ khởi hành.",
		],
	},
	ios: {
		label: "iOS",
		storeName: "App Store",
		requirement:
			"Yêu cầu iOS 15.0 trở lên, bật dịch vụ định vị chính xác để ghi nhận lộ trình ổn định trong chuyến đi.",
		steps: [
			"Đăng ký hoặc đăng nhập tài khoản CTMS để đồng bộ đặt chỗ và Hồ sơ sức khỏe tùy chọn.",
			"Cài đặt ứng dụng CTMS trên iPhone và cấp quyền thông báo cảnh báo thời tiết.",
			"Kiểm tra gói bản đồ ngoại tuyến và mức pin dự phòng trước khi xuất phát.",
		],
	},
};

export const MobileAppPage: React.FC<MobileAppPageProps> = ({
	initialPlatform = "android",
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	const [platform, setPlatform] = useState<MobilePlatform>(initialPlatform);
	const activePlatform = PLATFORM_DETAILS[platform];

	return (
		<PublicPageLayout
			eyebrow="Ứng dụng di động CTMS"
			title="Đồng hành trên mọi cung đường ngay cả khi mất sóng"
			subtitle="Ứng dụng di động CTMS đồng bộ trực tiếp với tài khoản web của bạn, hỗ trợ bản đồ ngoại tuyến, theo dõi lịch trình, điểm danh chuyến đi và cảnh báo an toàn."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button
					variant="primary"
					size="sm"
					onClick={onNavigateToRegister}
					className="bg-[#164027] hover:bg-[#0f2e1c]"
				>
					<span>Tạo tài khoản CTMS</span>
					<ArrowRight className="ml-1.5 size-4" />
				</Button>
			}
		>
			{/* Platform Selector & Preview */}
			<section className="grid grid-cols-1 items-center gap-8 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs lg:grid-cols-[1.15fr_0.85fr] sm:p-8">
				<div>
					<div className="inline-flex rounded-full border border-[#dfe8df] bg-[#f4f7f2] p-1">
						{(["android", "ios"] as const).map((item) => {
							const isActive = platform === item;
							return (
								<button
									key={item}
									type="button"
									onClick={() => setPlatform(item)}
									className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-semibold transition ${
										isActive ? "bg-[#164027] text-white" : "text-[#425048] hover:text-[#10221b]"
									}`}
								>
									{PLATFORM_DETAILS[item].storeName}
								</button>
							);
						})}
					</div>

					<div className="mt-5 flex flex-wrap items-center gap-2.5">
						<h2 className="text-xl font-bold text-[#10221b]">
							Phiên bản CTMS cho {activePlatform.label}
						</h2>
						<StatusBadge tone="info">Đang triển khai</StatusBadge>
					</div>

					<p className="mt-2.5 text-sm leading-relaxed text-[#425048]">
						{activePlatform.requirement}
					</p>

					<ol className="mt-5 space-y-3">
						{activePlatform.steps.map((step, index) => (
							<li key={step} className="flex items-start gap-2.5 text-sm text-[#254431]">
								<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef7f0] text-xs font-bold text-[#164027]">
									{index + 1}
								</span>
								<span>{step}</span>
							</li>
						))}
					</ol>

					<div className="mt-6 flex flex-wrap gap-2.5">
						<Button
							variant="primary"
							size="sm"
							onClick={() => onNavigateToPath("/trips")}
							className="bg-[#164027] hover:bg-[#0f2e1c]"
						>
							<Smartphone className="mr-1.5 size-4" />
							<span>Xem chuyến đi trên web</span>
						</Button>
						<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/safety")}>
							Tìm hiểu tính năng an toàn
						</Button>
					</div>
				</div>

				<div className="flex justify-center">
					<div className="w-full max-w-[320px] overflow-hidden rounded-[36px] border-8 border-[#283a2e] bg-white shadow-sm">
						<img
							src="/figma_assets/mobile_app.png"
							alt="Màn hình ứng dụng di động CTMS"
							className="block h-auto w-full object-cover"
						/>
					</div>
				</div>
			</section>

			{/* Capabilities Grid */}
			<section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
				{MOBILE_CAPABILITIES.map((cap) => {
					const Icon = cap.icon;
					return (
						<article
							key={cap.title}
							className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs"
						>
							<div className="flex size-10 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
								<Icon className="size-5" />
							</div>
							<h3 className="mt-4 text-base font-bold text-[#10221b]">{cap.title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-[#425048]">{cap.description}</p>
						</article>
					);
				})}
			</section>

			{/* Sync Note */}
			<section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:flex-row sm:items-center">
				<div className="flex items-start gap-3">
					<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#164027]" />
					<div>
						<h3 className="text-sm font-bold text-[#10221b]">
							Đồng bộ một tài khoản duy nhất giữa web và di động
						</h3>
						<p className="mt-1 text-xs leading-relaxed text-[#425048]">
							Mọi đơn đặt chỗ, xác nhận điều khoản và cài đặt chia sẻ Hồ sơ sức khỏe đều tự động
							đồng bộ khi bạn đăng nhập trên cả hai nền tảng.
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onNavigateToPath("/support")}
					className="shrink-0"
				>
					Xem hướng dẫn chi tiết
				</Button>
			</section>
		</PublicPageLayout>
	);
};
