import { Building2, Compass, Mail, Send, ShieldAlert, UserCheck } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button, useToast } from "../../../shared/components";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

type InquiryTopic = "camper" | "host" | "porter" | "safety";

const CONTACT_CHANNELS: Array<{
	topic: InquiryTopic;
	icon: React.ComponentType<{ className?: string }>;
	title: string;
	description: string;
	email: string;
}> = [
	{
		topic: "camper",
		icon: Compass,
		title: "Hỗ trợ người tham gia",
		description:
			"Giải đáp về đăng ký tài khoản, đặt chỗ chuyến đi, hủy trước chuyến đi và hoàn tiền.",
		email: "support@ditrek.local",
	},
	{
		topic: "host",
		icon: Building2,
		title: "Hợp tác đơn vị tổ chức",
		description: "Hướng dẫn thiết lập tuyến đường, mở chuyến đi, quản lý thiết bị và đối soát.",
		email: "partner@ditrek.local",
	},
	{
		topic: "porter",
		icon: UserCheck,
		title: "Xác minh người dẫn đường",
		description: "Hỗ trợ nộp chứng chỉ chuyên môn, xét duyệt hồ sơ và nhận phân công dẫn đoàn.",
		email: "guide@ditrek.local",
	},
	{
		topic: "safety",
		icon: ShieldAlert,
		title: "Báo cáo an toàn và tuyến đường",
		description: "Tiếp nhận phản ánh về điểm nguy hiểm, sạt lở, biển báo hoặc vi phạm vận hành.",
		email: "safety@ditrek.local",
	},
];

const TOPIC_LABELS: Record<InquiryTopic, string> = {
	camper: "Hỗ trợ người tham gia",
	host: "Hợp tác đơn vị tổ chức",
	porter: "Xác minh người dẫn đường",
	safety: "Báo cáo an toàn tuyến đường",
};

interface ContactFormErrors {
	fullName?: string;
	email?: string;
	message?: string;
}

export const ContactPage: React.FC<PublicPageProps> = ({
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	const toast = useToast();
	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [topic, setTopic] = useState<InquiryTopic>("camper");
	const [message, setMessage] = useState("");
	const [errors, setErrors] = useState<ContactFormErrors>({});

	const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const nextErrors: ContactFormErrors = {};

		if (fullName.trim().length < 2) {
			nextErrors.fullName = "Vui lòng nhập họ và tên của bạn.";
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			nextErrors.email = "Vui lòng nhập địa chỉ thư điện tử hợp lệ.";
		}
		if (message.trim().length < 15) {
			nextErrors.message = "Vui lòng mô tả nội dung cần hỗ trợ ít nhất 15 ký tự.";
		}

		setErrors(nextErrors);
		if (Object.keys(nextErrors).length > 0) {
			toast.error("Vui lòng kiểm tra lại các trường thông tin còn thiếu.");
			return;
		}

		toast.success(
			`Đã ghi nhận yêu cầu "${TOPIC_LABELS[topic]}". Đội ngũ DiTrek sẽ phản hồi tới ${email.trim()} trong thời gian sớm nhất.`
		);
		setFullName("");
		setEmail("");
		setMessage("");
		setErrors({});
	};

	return (
		<PublicPageLayout
			eyebrow="Kết nối với đội ngũ DiTrek"
			title="Liên hệ và hợp tác vận hành"
			subtitle="Chọn nhóm nội dung phù hợp hoặc gửi thông tin trực tiếp để bộ phận phụ trách DiTrek hỗ trợ bạn kịp thời."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button variant="outline" size="sm" onClick={() => onNavigateToPath("/support")}>
					Xem câu hỏi thường gặp
				</Button>
			}
		>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
				{/* Left: Purpose-based Channels */}
				<section className="space-y-4">
					{CONTACT_CHANNELS.map((channel) => {
						const Icon = channel.icon;
						const isSelected = topic === channel.topic;
						return (
							<button
								key={channel.topic}
								type="button"
								onClick={() => setTopic(channel.topic)}
								className={`w-full cursor-pointer rounded-2xl border bg-white p-5 text-left shadow-xs transition ${
									isSelected
										? "border-[#164027] ring-1 ring-[#164027]/20"
										: "border-[#dfe8df] hover:border-[#bfd2c2]"
								}`}
							>
								<div className="flex items-start gap-3.5">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eef7f0] text-[#164027]">
										<Icon className="size-5" />
									</div>
									<div className="min-w-0 flex-1">
										<h2 className="text-sm font-bold text-[#10221b]">{channel.title}</h2>
										<p className="mt-1 text-xs leading-relaxed text-[#425048]">
											{channel.description}
										</p>
										<p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164027]">
											<Mail className="size-3.5" />
											<span>{channel.email}</span>
										</p>
									</div>
								</div>
							</button>
						);
					})}

					<div className="rounded-2xl border border-[#d6e7da] bg-[#eef7f0]/70 p-4 text-xs leading-relaxed text-[#254431]">
						<strong className="block font-bold text-[#164027]">
							Lưu ý cho đơn đặt chỗ đang hoạt động
						</strong>
						<p className="mt-1">
							Nếu bạn cần hủy đặt chỗ trước chuyến đi hoặc gửi yêu cầu hoàn tiền sau chuyến đi, vui
							lòng đăng nhập và thực hiện trực tiếp trong trang chi tiết đơn để hệ thống lưu vết và
							xét duyệt minh bạch.
						</p>
					</div>
				</section>

				{/* Right: Contact Form */}
				<section className="rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:p-8">
					<h2 className="text-lg font-semibold text-[#10221b]">Gửi thông tin liên hệ</h2>
					<p className="mt-1 text-sm text-[#425048]">
						Điền nội dung cần trao đổi, hệ thống sẽ phân loại theo đúng bộ phận tiếp nhận.
					</p>

					<form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
						<div>
							<label
								htmlFor="contact-fullname"
								className="block text-xs font-semibold text-[#2d3e34]"
							>
								Họ và tên
							</label>
							<input
								id="contact-fullname"
								type="text"
								value={fullName}
								onChange={(event) => {
									setFullName(event.target.value);
									if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
								}}
								placeholder="Ví dụ: Nguyễn Minh Anh"
								className="mt-1.5 w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] px-4 py-2.5 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
							/>
							{errors.fullName && (
								<p className="mt-1 text-xs font-medium text-red-600">{errors.fullName}</p>
							)}
						</div>

						<div>
							<label htmlFor="contact-email" className="block text-xs font-semibold text-[#2d3e34]">
								Địa chỉ thư điện tử
							</label>
							<input
								id="contact-email"
								type="email"
								value={email}
								onChange={(event) => {
									setEmail(event.target.value);
									if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
								}}
								placeholder="ban@example.com"
								className="mt-1.5 w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] px-4 py-2.5 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
							/>
							{errors.email && (
								<p className="mt-1 text-xs font-medium text-red-600">{errors.email}</p>
							)}
						</div>

						<div>
							<label htmlFor="contact-topic" className="block text-xs font-semibold text-[#2d3e34]">
								Chủ đề cần trao đổi
							</label>
							<select
								id="contact-topic"
								value={topic}
								onChange={(event) => setTopic(event.target.value as InquiryTopic)}
								className="mt-1.5 w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] px-4 py-2.5 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
							>
								{(Object.keys(TOPIC_LABELS) as InquiryTopic[]).map((key) => (
									<option key={key} value={key}>
										{TOPIC_LABELS[key]}
									</option>
								))}
							</select>
						</div>

						<div>
							<label
								htmlFor="contact-message"
								className="block text-xs font-semibold text-[#2d3e34]"
							>
								Nội dung chi tiết
							</label>
							<textarea
								id="contact-message"
								rows={5}
								value={message}
								onChange={(event) => {
									setMessage(event.target.value);
									if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
								}}
								placeholder="Mô tả rõ chuyến đi, tuyến đường hoặc nội dung bạn muốn DiTrek hỗ trợ..."
								className="mt-1.5 w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] px-4 py-3 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
							/>
							{errors.message && (
								<p className="mt-1 text-xs font-medium text-red-600">{errors.message}</p>
							)}
						</div>

						<div className="flex flex-wrap items-center justify-between gap-3 pt-2">
							<Button type="button" variant="outline" size="sm" onClick={onNavigateToLogin}>
								Đăng nhập tài khoản
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								className="bg-[#164027] hover:bg-[#0f2e1c]"
							>
								<Send className="mr-1.5 size-4" />
								<span>Gửi yêu cầu liên hệ</span>
							</Button>
						</div>
					</form>
				</section>
			</div>
		</PublicPageLayout>
	);
};
