import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { Button } from "../../../shared/components/Button";
import { DataTable } from "../../../shared/components/DataTable";
import { Modal } from "../../../shared/components/Modal";
import { PageSkeleton } from "../../../shared/components/PageSkeleton";
import { Pagination } from "../../../shared/components/Pagination";
import { ReportState } from "../components/ReportState";
import { REPORT_PAGE_SIZE, reportDate, reportTypeLabel } from "../constants";
import { reportsService } from "../services/reports.service";
import type { OwnReport } from "../types";

export function MyReportsPage({ actor }: { actor: string }) {
	const [page, setPage] = useState(1);
	const [selected, setSelected] = useState<string | null>(null);
	const query = useQuery({
		queryKey: queryKeys.myContentReports.list(actor, page),
		queryFn: ({ signal }) => reportsService.list(page, signal),
		retry: false,
		staleTime: 0,
	});
	const detail = useQuery({
		queryKey: queryKeys.myContentReports.detail(actor, selected ?? ""),
		queryFn: ({ signal }) => reportsService.detail(selected as string, signal),
		enabled: Boolean(selected),
		retry: false,
	});
	const report = detail.data;
	return (
		<div className="bg-[#f4f7f2] text-brand-dark">
			<section aria-label="Lịch sử báo cáo" className="space-y-4 px-4 py-6 sm:px-6">
				<div className="flex items-center justify-between gap-4">
					<h1 className="text-lg font-extrabold sm:text-xl">Báo cáo đánh giá đã gửi</h1>
					<button
						type="button"
						aria-label="Làm mới danh sách báo cáo"
						title="Làm mới"
						className="shrink-0 cursor-pointer rounded-xl border border-[#dfe8df] p-2.5 text-[#55685a] transition hover:bg-[#f6f9f6] focus-visible:outline-2 focus-visible:outline-[#164027]"
						onClick={() => {
							void query.refetch({ cancelRefetch: false });
							if (selected) void detail.refetch({ cancelRefetch: false });
						}}
					>
						<RefreshCw
							aria-hidden="true"
							className={`size-4 ${query.isFetching ? "motion-safe:animate-spin" : ""}`}
						/>
					</button>
				</div>
				{query.isPending ? (
					<PageSkeleton />
				) : query.isError ? (
					<div role="alert" className="space-y-3">
						<p>Không tải được danh sách báo cáo. Vui lòng thử lại.</p>
						<Button variant="outline" onClick={() => void query.refetch()}>
							Thử lại
						</Button>
					</div>
				) : query.data.items.length === 0 ? (
					<section className="rounded-2xl border border-slate-200 bg-white p-6">
						<h2 className="font-semibold text-slate-900">Bạn chưa gửi báo cáo nào</h2>
						<p className="mt-2 text-sm text-slate-700">
							Để gửi báo cáo, mở một đánh giá gốc và chọn “Báo cáo nội dung”.
						</p>
						<a
							href="/host/review-analysis"
							className="mt-3 inline-block text-sm font-semibold text-brand-dark underline underline-offset-4"
						>
							Đến phần phân tích đánh giá
						</a>
					</section>
				) : (
					<>
						<ul className="space-y-3 lg:hidden" aria-label="Báo cáo đánh giá">
							{query.data.items.map((row) => (
								<li
									key={row.id}
									className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
								>
									<h2 className="font-semibold text-slate-900">
										{reportTypeLabel(row.reportType)}
									</h2>
									<p className="line-clamp-2 break-words text-sm text-slate-700">
										{row.description}
									</p>
									<p className="text-sm text-slate-700">{reportDate(row.createdAt)}</p>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<ReportState status={row.status} />
										<Button variant="outline" size="sm" onClick={() => setSelected(row.id)}>
											Xem chi tiết
										</Button>
									</div>
								</li>
							))}
						</ul>
						<div className="hidden lg:block">
							<DataTable<OwnReport>
								ariaLabel="Báo cáo đánh giá"
								rows={query.data.items}
								getRowKey={(row) => row.id}
								columns={[
									{
										key: "type",
										header: <span className="text-slate-700">Loại báo cáo</span>,
										render: (row) => (
											<span className="font-semibold">{reportTypeLabel(row.reportType)}</span>
										),
									},
									{
										key: "description",
										header: <span className="text-slate-700">Mô tả báo cáo</span>,
										render: (row) => (
											<p className="line-clamp-2 max-w-sm break-words">{row.description}</p>
										),
									},
									{
										key: "date",
										header: <span className="text-slate-700">Ngày gửi</span>,
										render: (row) => reportDate(row.createdAt),
									},
									{
										key: "state",
										header: <span className="text-slate-700">Trạng thái</span>,
										render: (row) => <ReportState status={row.status} />,
									},
									{
										key: "detail",
										header: <span className="text-slate-700">Chi tiết</span>,
										render: (row) => (
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setSelected(row.id)}
												aria-label={`Xem chi tiết báo cáo ${reportTypeLabel(row.reportType)}, ${reportDate(row.createdAt)}`}
											>
												Xem
											</Button>
										),
									},
								]}
							/>
						</div>
						<Pagination
							currentPage={page}
							totalPages={query.data.pagination.totalPages}
							totalItems={query.data.pagination.total}
							itemsPerPage={REPORT_PAGE_SIZE}
							onPageChange={setPage}
						/>
					</>
				)}
				{selected && (
					<Modal isOpen title="Chi tiết báo cáo" onClose={() => setSelected(null)}>
						{detail.isPending ? (
							<p aria-live="polite">Đang tải báo cáo…</p>
						) : detail.isError ? (
							<div role="alert">
								<p>Không thể tải báo cáo này.</p>
								<Button variant="outline" onClick={() => void detail.refetch()}>
									Thử lại
								</Button>
							</div>
						) : (
							report && (
								<div className="space-y-4">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<h3 className="font-semibold">{reportTypeLabel(report.reportType)}</h3>
										<ReportState status={report.status} />
									</div>
									<p className="text-sm text-slate-700">Gửi lúc {reportDate(report.createdAt)}</p>
									<p className="whitespace-pre-wrap break-words text-sm">{report.description}</p>
									<div className="space-y-2 border-t border-border pt-4 text-sm text-slate-700">
										<p>Một đánh giá của người tham gia.</p>
										{(report.status === "pending" || report.status === "reviewing") && (
											<p>Khi có kết quả, trạng thái sẽ được cập nhật tại đây.</p>
										)}
										{reportDate(report.updatedAt) !== reportDate(report.createdAt) && (
											<p>Cập nhật lúc {reportDate(report.updatedAt)}.</p>
										)}
										<p className="font-semibold text-brand-dark">
											Gửi báo cáo không tự động gỡ đánh giá.
										</p>
									</div>
								</div>
							)
						)}
					</Modal>
				)}
			</section>
		</div>
	);
}
