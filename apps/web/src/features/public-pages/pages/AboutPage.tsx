import { ArrowRight, CheckCircle2, Compass, ShieldCheck, Smartphone, Users } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

const ROLE_CARDS = [
	{
		role: "Người tham gia",
		summary: "Tìm kiếm chuyến đi theo nhu cầu, đặt chỗ trực tuyến và theo dõi hành trình an toàn.",
		points: [
			"Lọc chuyến đi theo khu vực, độ khó, thời gian và cảnh báo thời tiết",
			"Tùy chọn chia sẻ Hồ sơ sức khỏe khi đặt chỗ để được hỗ trợ tốt hơn",
			"Quản lý rõ ràng giữa hủy đặt chỗ trước chuyến đi và yêu cầu hoàn tiền sau chuyến đi",
		],
	},
	{
		role: "Đơn vị tổ chức",
		summary:
			"Xây dựng tuyến đường, mở bán chuyến đi, điều phối nhân sự và theo dõi doanh thu minh bạch.",
		points: [
			"Tạo tuyến đường chi tiết với điểm kiểm soát và danh mục thiết bị đi kèm",
			"Mời người dẫn đường đã xác minh, quản lý danh sách thành viên và điểm danh",
			"Theo dõi báo cáo vận hành, đối soát và xử lý tín hiệu khẩn cấp theo thời gian thực",
		],
	},
	{
		role: "Người dẫn đường",
		summary: "Đồng hành trực tiếp ngoài thực địa với hồ sơ chứng chỉ được hệ thống kiểm duyệt.",
		points: [
			"Nộp chứng chỉ chuyên môn và cấp bậc dẫn đoàn để quản trị viên xác minh",
			"Nhận lời mời phụ trách chuyến đi và kiểm tra danh sách đoàn trước giờ xuất phát",
			"Hỗ trợ điểm danh thành viên và cập nhật tình huống thực địa kịp thời",
		],
	},
	{
		role: "Quản trị viên",
		summary:
			"Giám sát chất lượng tuyến đường, quy tắc thời tiết, khiếu nại và tính minh bạch toàn hệ thống.",
		points: [
			"Kiểm duyệt tuyến đường, điểm nguy hiểm và hồ sơ xác minh người dẫn đường",
			"Thiết lập ngưỡng cảnh báo thời tiết, xử lý hoàn tiền và quyết toán theo quy trình truy vết",
			"Quản lý điều khoản sử dụng, nhật ký kiểm toán và tài liệu kỹ năng sinh tồn",
		],
	},
];

const HIGHLIGHTS = [
	{
		icon: Compass,
		title: "Chuẩn hóa vận hành dã ngoại",
		description:
			"Gắn kết dữ liệu tuyến đường, lịch trình chuyến đi, thiết bị cần thiết và phân công người dẫn đường trên một nền tảng thống nhất.",
	},
	{
		icon: ShieldCheck,
		title: "Minh bạch từ đặt chỗ đến quyết toán",
		description:
			"Mọi bước gửi yêu cầu, xét duyệt và xác nhận chuyển tiền đều tách bạch trạng thái rõ ràng để bảo vệ cả người tham gia và đơn vị tổ chức.",
	},
	{
		icon: Smartphone,
		title: "Đồng bộ giữa trang web và ứng dụng di động",
		description:
			"Lập kế hoạch và quản lý thuận tiện trên web, đồng thời sử dụng bản đồ ngoại tuyến và công cụ hỗ trợ an toàn trên điện thoại khi vào rừng.",
	},
	{
		icon: Users,
		title: "Phân vai rõ ràng theo trách nhiệm",
		description:
			"Mỗi vai trò có không gian làm việc riêng, giảm thao tác thừa và đảm bảo đúng quyền hạn cho từng nghiệp vụ.",
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
			eyebrow="Về nền tảng CTMS"
			title="Hệ thống Quản lý Điểm cắm trại và Chuyến đi Dã ngoại"
			subtitle="CTMS được xây dựng nhằm kết nối người tham gia, đơn vị tổ chức và người dẫn đường trên một quy trình vận hành an toàn, minh bạch và phù hợp với đặc thù địa hình tại Việt Nam."
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
			{/* Core Values */}
			<section className="grid grid-cols-1 gap-4 md:grid-cols-2">
				{HIGHLIGHTS.map((item) => {
					const Icon = item.icon;
					return (
						<article
							key={item.title}
							className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs"
						>
							<div className="flex size-10 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
								<Icon className="size-5" />
							</div>
							<h2 className="mt-4 text-base font-bold text-[#10221b]">{item.title}</h2>
							<p className="mt-2 text-sm leading-relaxed text-[#425048]">{item.description}</p>
						</article>
					);
				})}
			</section>

			{/* 4 Roles Ecosystem */}
			<section className="mt-6 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:p-8">
				<h2 className="text-lg font-semibold text-[#10221b]">
					Hệ sinh thái bốn vai trò trong CTMS
				</h2>
				<p className="mt-1.5 text-sm leading-relaxed text-[#425048]">
					Mỗi nhóm người dùng đều có công cụ chuyên biệt để phối hợp trơn tru trước, trong và sau
					mỗi chuyến đi.
				</p>

				<div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
					{ROLE_CARDS.map((card) => (
						<div
							key={card.role}
							className="border-t border-[#eef2ee] pt-5 first:border-t-0 first:pt-0 md:border-t md:pt-5"
						>
							<h3 className="text-base font-bold text-[#164027]">{card.role}</h3>
							<p className="mt-1.5 text-sm text-[#425048]">{card.summary}</p>
							<ul className="mt-3 space-y-2">
								{card.points.map((point) => (
									<li key={point} className="flex items-start gap-2 text-sm text-[#2d3e34]">
										<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#164027]" />
										<span>{point}</span>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
			</section>

			{/* Bottom CTA */}
			<section className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:flex-row sm:items-center">
				<div>
					<h2 className="text-base font-bold text-[#10221b]">Sẵn sàng bắt đầu cùng CTMS?</h2>
					<p className="mt-1 text-sm text-[#425048]">
						Tạo tài khoản để đặt chuyến đi, đăng ký làm đơn vị tổ chức hoặc tham gia đội ngũ người
						dẫn đường.
					</p>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/contact")}>
						Liên hệ đội ngũ
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
