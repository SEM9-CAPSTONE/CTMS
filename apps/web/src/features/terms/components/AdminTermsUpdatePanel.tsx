import { ExternalLink, Globe, Send } from "lucide-react";
import type React from "react";
import { Button } from "../../../shared/components";

const MAX_SUMMARY_LENGTH = 500;

export interface AdminTermsUpdatePanelProps {
	summary: string;
	requiresReconsent: boolean;
	isSubmitting: boolean;
	onChangeSummary: (value: string) => void;
	onChangeRequiresReconsent: (checked: boolean) => void;
	onSubmitVersion: () => void;
	onOpenPublicTerms: () => void;
}

export const AdminTermsUpdatePanel: React.FC<AdminTermsUpdatePanelProps> = ({
	summary,
	requiresReconsent,
	isSubmitting,
	onChangeSummary,
	onChangeRequiresReconsent,
	onSubmitVersion,
	onOpenPublicTerms,
}) => {
	return (
		<aside className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
			<h2 className="text-base font-bold text-[#10221b]">Cập nhật phiên bản</h2>

			{/* Scope */}
			<div className="mt-4">
				<p className="text-xs font-semibold text-[#2f4c40]">Phạm vi áp dụng</p>
				<div className="mt-2 flex items-start gap-2.5 rounded-xl border border-[#cde0d1] bg-[#f3faf5] p-3.5">
					<Globe className="mt-0.5 size-4 shrink-0 text-[#164027]" />
					<div className="text-xs leading-relaxed">
						<p className="font-bold text-[#164027]">
							Toàn bộ hệ thống CTMS — Trang web và Ứng dụng di động
						</p>
						<p className="mt-0.5 text-[#425048]">
							Áp dụng cho Người tham gia, Đơn vị tổ chức và Người dẫn đường.
						</p>
					</div>
				</div>
			</div>

			{/* Change Summary */}
			<div className="mt-4">
				<label
					htmlFor="admin-terms-summary"
					className="mb-1.5 block text-xs font-semibold text-[#2f4c40]"
				>
					Tóm tắt thay đổi <span className="text-red-600">*</span>
				</label>
				<textarea
					id="admin-terms-summary"
					rows={5}
					maxLength={MAX_SUMMARY_LENGTH}
					value={summary}
					onChange={(event) => onChangeSummary(event.target.value)}
					placeholder="Nêu ngắn gọn các điểm thay đổi chính trong phiên bản này..."
					className="w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#10221b] outline-none transition focus:border-[#164027]"
				/>
				<p className="mt-1 text-right text-[11px] font-medium text-[#667a6d]">
					{summary.length} / {MAX_SUMMARY_LENGTH}
				</p>
			</div>

			{/* Notification checkbox */}
			<label className="mt-3 flex cursor-pointer items-start gap-2.5">
				<input
					type="checkbox"
					checked={requiresReconsent}
					onChange={(event) => onChangeRequiresReconsent(event.target.checked)}
					className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-[#b8c7bc] accent-[#164027]"
				/>
				<span className="text-xs leading-relaxed">
					<strong className="block font-semibold text-[#10221b]">Thông báo đến người dùng</strong>
					<span className="text-[#54655a]">
						Gửi thông báo yêu cầu xác nhận lại khi phiên bản mới có hiệu lực.
					</span>
				</span>
			</label>

			{/* Submit CTA */}
			<Button
				variant="primary"
				size="sm"
				onClick={onSubmitVersion}
				disabled={isSubmitting}
				className="mt-5 w-full justify-center gap-2 bg-[#164027] py-2.5 hover:bg-[#0f2e1c]"
			>
				<Send className="size-4" />
				<span>{isSubmitting ? "Đang cập nhật..." : "Cập nhật phiên bản"}</span>
			</Button>

			<Button
				variant="outline"
				size="sm"
				onClick={onOpenPublicTerms}
				className="mt-2.5 w-full justify-center gap-1.5"
			>
				<ExternalLink className="size-3.5" />
				<span>Xem trang công khai</span>
			</Button>
		</aside>
	);
};
