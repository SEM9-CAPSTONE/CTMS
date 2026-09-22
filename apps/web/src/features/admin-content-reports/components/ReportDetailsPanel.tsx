import { reportActions } from "../constants";
import type { ContentReport, ReportError, ReportStatus } from "../types";
import { ReportErrorNotice } from "./ReportErrorNotice";
import { ReportStatusBadge } from "./ReportStatusBadge";

interface Props {
	report: ContentReport | null;
	loading: boolean;
	submitting: boolean;
	error: ReportError | null;
	actionError: ReportError | null;
	success: string | null;
	onClose: () => void;
	onRetry: () => void;
	onSubmit: (status: ReportStatus) => void;
}
export function ReportDetailsPanel({
	report,
	loading,
	submitting,
	error,
	actionError,
	success,
	onClose,
	onRetry,
	onSubmit,
}: Props) {
	return (
		<section
			aria-labelledby="report-detail-title"
			aria-busy={loading || submitting}
			className="space-y-4 rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-sm"
		>
			<div className="flex items-center justify-between gap-3">
				<h2 id="report-detail-title" className="text-lg font-extrabold">
					Chi tiết báo cáo
				</h2>
				<button
					type="button"
					disabled={submitting}
					onClick={onClose}
					className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
				>
					Đóng chi tiết
				</button>
			</div>
			{success && (
				<output className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</output>
			)}
			{actionError && <ReportErrorNotice error={actionError} />}
			{loading && <output>Đang tải chi tiết báo cáo...</output>}
			{error && <ReportErrorNotice error={error} onRetry={onRetry} />}
			{report && !loading && !error && (
				<>
					<ReportStatusBadge status={report.status} />
					<dl className="space-y-3 text-sm">
						{[
							["Mã báo cáo", report.id],
							["Người báo cáo", report.reporter.fullName || "Chưa cập nhật họ tên"],
							["ID người báo cáo", report.reporter.id],
							["Loại đối tượng", report.targetType],
							["ID đối tượng", report.targetId],
							["Lý do", report.reason],
							["Ngày tạo", new Date(report.createdAt).toLocaleString("vi-VN")],
							["Cập nhật lần cuối", new Date(report.updatedAt).toLocaleString("vi-VN")],
						].map(([label, value]) => (
							<div key={label}>
								<dt className="font-bold text-[#667a6d]">{label}</dt>
								<dd className="mt-1 whitespace-pre-wrap break-words">{value}</dd>
							</div>
						))}
					</dl>
					<p className="rounded-xl bg-[#f1f5f0] p-3 text-xs text-[#54655a]">
						Các thao tác chỉ cập nhật trạng thái báo cáo. “Đã xử lý” không có nghĩa nội dung hoặc
						dịch vụ được báo cáo đã bị thay đổi.
					</p>
					{reportActions(report.status).length > 0 && (
						<div className="flex flex-wrap gap-2">
							{reportActions(report.status).map((action) => (
								<button
									key={action.status}
									type="button"
									disabled={submitting}
									onClick={() => onSubmit(action.status)}
									className="rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#205c39] disabled:opacity-50"
								>
									{action.label}
								</button>
							))}
						</div>
					)}
				</>
			)}
			{submitting && <output>Đang cập nhật báo cáo...</output>}
		</section>
	);
}
