import { ChevronDown, Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

type SupportCategory = "Tất cả" | "Tài khoản" | "Đặt chỗ và hoàn tiền" | "An toàn và di động";

interface FaqItem {
	id: string;
	category: Exclude<SupportCategory, "Tất cả">;
	question: string;
	answer: string;
}

const SUPPORT_CATEGORIES: SupportCategory[] = [
	"Tất cả",
	"Tài khoản",
	"Đặt chỗ và hoàn tiền",
	"An toàn và di động",
];

const FAQ_ITEMS: FaqItem[] = [
	{
		id: "register-otp",
		category: "Tài khoản",
		question: "Làm thế nào để đăng ký tài khoản và chọn vai trò trên CTMS?",
		answer:
			"Bạn nhấn Đăng ký ở góc phải màn hình, chọn vai trò phù hợp (Người tham gia, Đơn vị tổ chức hoặc Người dẫn đường), đọc và xác nhận Điều khoản và Chính sách sử dụng, sau đó nhập mã xác thực gửi về thư điện tử để kích hoạt tài khoản.",
	},
	{
		id: "porter-verification",
		category: "Tài khoản",
		question: "Người dẫn đường cần chuẩn bị gì để nhận phân công chuyến đi?",
		answer:
			"Sau khi đăng ký vai trò Người dẫn đường, bạn cần tải lên chứng chỉ dẫn đoàn hoặc giấy tờ chuyên môn liên quan tại mục Xác minh hồ sơ. Quản trị viên sẽ kiểm duyệt trước khi mở khóa đầy đủ chức năng nhận lời mời từ đơn vị tổ chức.",
	},
	{
		id: "cancel-vs-refund",
		category: "Đặt chỗ và hoàn tiền",
		question: "Hủy đặt chỗ trước chuyến đi khác gì với yêu cầu hoàn tiền sau chuyến đi?",
		answer:
			"Hủy đặt chỗ trước chuyến đi áp dụng khi hành trình chưa diễn ra, theo chính sách hủy công bố trên từng chuyến. Yêu cầu hoàn tiền sau chuyến đi áp dụng khi bạn gặp sự cố dịch vụ hoặc khiếu nại sau khi kết thúc chuyến; yêu cầu này sẽ được quản trị viên xét duyệt độc lập rồi mới tiến hành xác nhận chuyển tiền.",
	},
	{
		id: "health-consent",
		category: "Đặt chỗ và hoàn tiền",
		question: "Tôi có bắt buộc chia sẻ Hồ sơ sức khỏe khi đăng ký không?",
		answer:
			"Không bắt buộc. Khi tạo tài khoản bạn không phải chia sẻ dữ liệu sức khỏe. Tùy chọn đồng ý chia sẻ Hồ sơ sức khỏe chỉ xuất hiện tại bước xác nhận đặt chỗ để đơn vị tổ chức và người dẫn đường hỗ trợ an toàn tốt hơn trong chuyến đi đó.",
	},
	{
		id: "weather-red-block",
		category: "An toàn và di động",
		question: "Vì sao một số chuyến đi tạm ngừng nhận đặt chỗ khi thời tiết xấu?",
		answer:
			"CTMS theo dõi dự báo thời tiết theo từng khu vực. Khi điều kiện thời tiết chạm ngưỡng nguy cơ cao (Mức Đỏ), hệ thống tự động chặn đặt chỗ mới để bảo vệ an toàn cho người tham gia và hỗ trợ đơn vị tổ chức xử lý hoãn hoặc hủy chuyến.",
	},
	{
		id: "offline-map-mobile",
		category: "An toàn và di động",
		question: "Cách sử dụng bản đồ khi vào khu vực rừng núi không có sóng di động?",
		answer:
			"Trước giờ khởi hành, bạn mở ứng dụng di động CTMS khi còn kết nối mạng để tải sẵn gói bản đồ khu vực và lộ trình chuyến đi. Khi di chuyển trong vùng mất sóng, ứng dụng vẫn hiển thị tuyến đường và hỗ trợ tra cứu hướng dẫn sinh tồn cơ bản.",
	},
];

export const SupportCenterPage: React.FC<PublicPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	const [searchText, setSearchText] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<SupportCategory>("Tất cả");
	const [openIds, setOpenIds] = useState<Record<string, boolean>>({
		"register-otp": true,
		"cancel-vs-refund": true,
	});

	const filteredFaqs = useMemo(() => {
		const keyword = searchText.trim().toLowerCase();
		return FAQ_ITEMS.filter((item) => {
			if (selectedCategory !== "Tất cả" && item.category !== selectedCategory) return false;
			if (!keyword) return true;
			return (
				item.question.toLowerCase().includes(keyword) || item.answer.toLowerCase().includes(keyword)
			);
		});
	}, [searchText, selectedCategory]);

	const toggleItem = (id: string) => {
		setOpenIds((prev) => ({ ...prev, [id]: !prev[id] }));
	};

	return (
		<PublicPageLayout
			eyebrow="Trung tâm hỗ trợ CTMS"
			title="Hướng dẫn sử dụng và câu hỏi thường gặp"
			subtitle="Tra cứu nhanh quy trình đăng ký, đặt chỗ, hủy chuyến, hoàn tiền, chia sẻ Hồ sơ sức khỏe và sử dụng ứng dụng di động khi đi dã ngoại."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button
					variant="primary"
					size="sm"
					onClick={() => onNavigateToPath("/contact")}
					className="bg-[#164027] hover:bg-[#0f2e1c]"
				>
					Gửi yêu cầu hỗ trợ
				</Button>
			}
		>
			{/* Search and Category Filter */}
			<section className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#54655a]" />
						<input
							type="text"
							value={searchText}
							onChange={(event) => setSearchText(event.target.value)}
							placeholder="Tìm câu hỏi về đặt chỗ, hoàn tiền, bản đồ ngoại tuyến..."
							className="w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] py-2.5 pr-4 pl-10 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
						/>
					</div>

					<div className="flex flex-wrap gap-2">
						{SUPPORT_CATEGORIES.map((category) => {
							const isActive = selectedCategory === category;
							return (
								<button
									key={category}
									type="button"
									onClick={() => setSelectedCategory(category)}
									className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
										isActive
											? "bg-[#164027] text-white"
											: "border border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f4f7f2]"
									}`}
								>
									{category}
								</button>
							);
						})}
					</div>
				</div>
			</section>

			{/* FAQ Accordion */}
			<section className="mt-6 rounded-2xl border border-[#dfe8df] bg-white shadow-xs">
				{filteredFaqs.length === 0 ? (
					<div className="p-8 text-center">
						<p className="text-sm font-bold text-[#10221b]">Không tìm thấy câu hỏi phù hợp</p>
						<p className="mt-1 text-xs text-[#54655a]">
							Bạn có thể thử từ khóa khác hoặc gửi trực tiếp câu hỏi tại trang Liên hệ.
						</p>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setSearchText("");
								setSelectedCategory("Tất cả");
							}}
							className="mt-4"
						>
							Xem toàn bộ câu hỏi
						</Button>
					</div>
				) : (
					<div className="divide-y divide-[#eef2ee]">
						{filteredFaqs.map((item) => {
							const isOpen = Boolean(openIds[item.id]);
							return (
								<div key={item.id} className="px-6 py-4">
									<button
										type="button"
										onClick={() => toggleItem(item.id)}
										aria-expanded={isOpen}
										className="flex w-full cursor-pointer items-center justify-between gap-4 py-1 text-left"
									>
										<div>
											<span className="text-[11px] font-semibold tracking-wide text-[#2d5a27]">
												{item.category}
											</span>
											<h2 className="mt-0.5 text-sm font-bold text-[#10221b] sm:text-base">
												{item.question}
											</h2>
										</div>
										<ChevronDown
											className={`size-4 shrink-0 text-[#54655a] transition-transform duration-150 ${
												isOpen ? "rotate-180 text-[#164027]" : ""
											}`}
										/>
									</button>
									{isOpen && (
										<p className="mt-2.5 pr-8 text-sm leading-relaxed text-[#35463c]">
											{item.answer}
										</p>
									)}
								</div>
							);
						})}
					</div>
				)}
			</section>

			{/* Helpful Cross-links */}
			<section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div>
						<h3 className="text-sm font-bold text-[#10221b]">Điều khoản và Chính sách</h3>
						<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
							Đọc đầy đủ quyền và nghĩa vụ của người tham gia, đơn vị tổ chức và người dẫn đường.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onNavigateToPath("/terms-and-policy")}
						className="mt-4 w-fit"
					>
						Xem điều khoản
					</Button>
				</div>

				<div className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div>
						<h3 className="text-sm font-bold text-[#10221b]">Trung tâm an toàn</h3>
						<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
							Tìm hiểu cơ chế cảnh báo thời tiết, vùng nguy hiểm và tín hiệu cầu cứu khẩn cấp.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => onNavigateToPath("/safety")}
						className="mt-4 w-fit"
					>
						Xem hướng dẫn an toàn
					</Button>
				</div>

				<div className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<div>
						<h3 className="text-sm font-bold text-[#10221b]">Cần trao đổi trực tiếp?</h3>
						<p className="mt-1.5 text-xs leading-relaxed text-[#425048]">
							Gửi yêu cầu chi tiết cho bộ phận phụ trách CTMS nếu câu hỏi của bạn chưa có ở đây.
						</p>
					</div>
					<Button
						variant="primary"
						size="sm"
						onClick={() => onNavigateToPath("/contact")}
						className="mt-4 w-fit bg-[#164027] hover:bg-[#0f2e1c]"
					>
						Đến trang liên hệ
					</Button>
				</div>
			</section>
		</PublicPageLayout>
	);
};
