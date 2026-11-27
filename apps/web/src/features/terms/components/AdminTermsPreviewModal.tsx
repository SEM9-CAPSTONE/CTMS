import { Calendar, Info } from "lucide-react";
import type React from "react";
import { Modal, StatusBadge } from "../../../shared/components";
import { formatTermsDate, formatTermsVersionLabel } from "../constants";
import type { TermsSection } from "../types";

export interface AdminTermsPreviewModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	versionCode: string;
	effectiveDate: string;
	sections: TermsSection[];
}

export const AdminTermsPreviewModal: React.FC<AdminTermsPreviewModalProps> = ({
	isOpen,
	onClose,
	title,
	versionCode,
	effectiveDate,
	sections,
}) => {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="Xem trước Điều khoản và Chính sách"
			description="Nội dung hiển thị trên trang công khai sau khi cập nhật phiên bản."
			size="2xl"
		>
			<div className="space-y-6">
				<div className="border-b border-[#eef2ee] pb-4">
					<h3 className="text-xl font-extrabold text-[#10221b]">{title}</h3>
					<div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#54655a]">
						<span className="inline-flex items-center gap-1.5">
							<Calendar className="size-3.5 text-[#164027]" />
							<span>Hiệu lực: {effectiveDate ? formatTermsDate(effectiveDate) : "Chưa chọn"}</span>
						</span>
						<StatusBadge tone="success">
							{formatTermsVersionLabel(versionCode || "1.0")}
						</StatusBadge>
					</div>
				</div>

				<div className="space-y-6">
					{sections.map((section) => (
						<section
							key={section.number}
							className="border-b border-[#eef2ee] pb-5 last:border-b-0 last:pb-0"
						>
							<h4 className="text-base font-bold text-[#10221b]">
								{section.number}. {section.title}
							</h4>
							<div className="mt-3 space-y-3">
								{section.subsections.map((sub) => (
									<div key={`${section.number}-${sub.code}`} className="space-y-1">
										<h5 className="text-sm font-bold text-[#164027]">
											{sub.code}. {sub.title}
										</h5>
										<p className="text-sm leading-relaxed text-[#35463c]">{sub.body}</p>
									</div>
								))}
							</div>
							{section.callout && (
								<div className="mt-3 flex items-start gap-2 rounded-xl border border-[#d6e7da] bg-[#f4f7f2] px-3.5 py-2.5 text-xs text-[#254431]">
									<Info className="mt-0.5 size-4 shrink-0 text-[#164027]" />
									<p>{section.callout}</p>
								</div>
							)}
						</section>
					))}
				</div>
			</div>
		</Modal>
	);
};
