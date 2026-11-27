import { ArrowRight, CheckCircle2, HeartPulse, Lock, ShieldCheck } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

const PRIVACY_SECTIONS = [
	{
		number: "1",
		title: "Dữ liệu tài khoản và hồ sơ vai trò",
		body: "Khi đăng ký tài khoản DiTrek, hệ thống thu thập thông tin cơ bản phục vụ định danh và liên lạc như họ tên, địa chỉ thư điện tử, số điện thoại và vai trò sử dụng. Với người dẫn đường và đơn vị tổ chức, hệ thống lưu trữ bổ sung chứng chỉ chuyên môn, hồ sơ năng lực và thông tin tài khoản nhận thanh toán phục vụ xác minh và đối soát.",
	},
	{
		number: "2",
		title: "Dữ liệu đặt chỗ, thanh toán và hoàn tiền",
		body: "Thông tin đơn đặt chỗ, lịch sử thanh toán, yêu cầu hủy trước chuyến đi và yêu cầu hoàn tiền sau chuyến đi được lưu giữ để phục vụ xác nhận chỗ, xử lý khiếu nại và lập biên bản đối soát giữa người tham gia, đơn vị tổ chức và quản trị viên.",
	},
	{
		number: "3",
		title: "Hồ sơ sức khỏe và quyền chia sẻ tùy chọn",
		body: "Hồ sơ sức khỏe (dị ứng, tiền sử bệnh lý, nhóm máu và thông tin liên hệ khẩn cấp) là dữ liệu nhạy cảm và hoàn toàn không bắt buộc. Hệ thống chỉ chia sẻ thông tin này với đơn vị tổ chức và người dẫn đường phụ trách chuyến đi khi bạn chủ động đánh dấu đồng ý trong lúc đặt chỗ, và bạn có thể chỉnh sửa hoặc thu hồi quyền chia sẻ bất cứ lúc nào trong phần hồ sơ cá nhân.",
	},
	{
		number: "4",
		title: "Dữ liệu vị trí, bản đồ ngoại tuyến và tín hiệu khẩn cấp",
		body: "Trong quá trình tham gia chuyến đi trên ứng dụng di động, tọa độ định vị chỉ được ghi nhận khi bạn cấp quyền vị trí để hiển thị lộ trình, tải bản đồ khu vực, điểm danh chặng hoặc gửi tín hiệu cầu cứu khẩn cấp kèm vị trí gần nhất tới bộ phận điều phối chuyến đi.",
	},
	{
		number: "5",
		title: "Kiểm soát truy cập và nhật ký bảo mật",
		body: "Dữ liệu trên DiTrek được phân quyền theo đúng vai trò người dùng. Các tác vụ quan trọng như xác minh người dẫn đường, phê duyệt hoàn tiền, cập nhật điều khoản sử dụng hay khóa tài khoản đều được ghi nhận trong nhật ký hệ thống nhằm bảo đảm khả năng truy vết và phòng chống truy cập trái phép.",
	},
];

export const PrivacyPolicyPage: React.FC<PublicPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	return (
		<PublicPageLayout
			eyebrow="Bảo mật và quyền riêng tư"
			title="Chính sách bảo mật dữ liệu DiTrek"
			subtitle="Nguyên tắc thu thập, sử dụng, phân quyền truy cập và bảo vệ thông tin cá nhân trên nền tảng web và ứng dụng di động DiTrek."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/terms-and-policy")}>
					<span>Xem Điều khoản sử dụng</span>
					<ArrowRight className="ml-1.5 size-4" />
				</Button>
			}
		>
			{/* Summary Principles */}
			<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div className="flex size-9 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
						<Lock className="size-4" />
					</div>
					<h2 className="mt-3 text-sm font-bold text-[#10221b]">Thu thập đúng mục đích</h2>
					<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
						Chỉ ghi nhận dữ liệu cần thiết cho việc đăng ký, đặt chỗ, xác minh vai trò và bảo đảm an
						toàn trong suốt chuyến đi.
					</p>
				</div>
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div className="flex size-9 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
						<HeartPulse className="size-4" />
					</div>
					<h2 className="mt-3 text-sm font-bold text-[#10221b]">Hồ sơ sức khỏe tách biệt</h2>
					<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
						Không bắt buộc chia sẻ khi đăng ký tài khoản; người tham gia chỉ chọn chia sẻ khi đặt
						chỗ và có quyền thu hồi bất cứ lúc nào.
					</p>
				</div>
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div className="flex size-9 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
						<ShieldCheck className="size-4" />
					</div>
					<h2 className="mt-3 text-sm font-bold text-[#10221b]">Phân quyền và truy vết</h2>
					<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
						Chỉ các bên có trách nhiệm trực tiếp trong chuyến đi mới được xem thông tin liên quan,
						kèm lịch sử tác động hệ thống.
					</p>
				</div>
			</section>

			{/* Policy Details */}
			<article className="mt-6 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:p-8">
				<div className="space-y-6">
					{PRIVACY_SECTIONS.map((section) => (
						<section
							key={section.number}
							className="border-b border-[#eef2ee] pb-6 last:border-b-0 last:pb-0"
						>
							<h2 className="text-base font-bold text-[#10221b]">
								{section.number}. {section.title}
							</h2>
							<p className="mt-2 text-sm leading-relaxed text-[#35463c]">{section.body}</p>
						</section>
					))}
				</div>

				<div className="mt-8 rounded-2xl border border-[#d6e7da] bg-[#f4f7f2] p-5">
					<h3 className="text-sm font-bold text-[#164027]">Quyền kiểm soát của bạn trên DiTrek</h3>
					<ul className="mt-2.5 space-y-2 text-sm text-[#254431]">
						<li className="flex items-start gap-2">
							<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#164027]" />
							<span>Xem và cập nhật thông tin hồ sơ cá nhân, liên hệ khẩn cấp bất cứ lúc nào.</span>
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#164027]" />
							<span>
								Bật hoặc tắt lựa chọn chia sẻ Hồ sơ sức khỏe cho từng lần đặt chỗ trên trang web và
								ứng dụng di động.
							</span>
						</li>
						<li className="flex items-start gap-2">
							<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#164027]" />
							<span>
								Liên hệ đội ngũ DiTrek qua trang Hỗ trợ hoặc Liên hệ nếu cần giải đáp về dữ liệu tài
								khoản.
							</span>
						</li>
					</ul>
				</div>
			</article>
		</PublicPageLayout>
	);
};
