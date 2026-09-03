import { AlertCircle, ChevronLeft, ChevronRight, Loader2, RefreshCw, TentTree } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "../../../shared/components";
import { toast } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminCampsitesTable } from "../components/AdminCampsitesTable";
import { ReviewCampsiteDialog } from "../components/ReviewCampsiteDialog";
import { useAdminCampsites, useReviewCampsite } from "../hooks/useAdminCampsites";
import type { CreatedCampsite } from "../types";

export interface AdminCampsitesPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminCampsitesPage({ onLogout }: AdminCampsitesPageProps) {
	const { campsites, isLoading, error: listError, reload } = useAdminCampsites();
	const { isSubmitting, error: actionError, submit, reset } = useReviewCampsite();

	const [selectedCampsite, setSelectedCampsite] = useState<CreatedCampsite | null>(null);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState(1);
	const ITEMS_PER_PAGE = 10;

	// biome-ignore lint/correctness/useExhaustiveDependencies: trigger page reset on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [statusFilter]);

	const filteredCampsites = useMemo(() => {
		if (statusFilter === "all") {
			return campsites;
		}
		if (statusFilter === "pending") {
			return campsites.filter((item) => item.status === "pending_approval");
		}
		if (statusFilter === "approved") {
			return campsites.filter((item) => item.status === "active");
		}
		if (statusFilter === "declined") {
			return campsites.filter((item) => item.status === "draft");
		}
		return campsites;
	}, [campsites, statusFilter]);

	const totalCampsites = filteredCampsites.length;
	const totalPages = Math.ceil(totalCampsites / ITEMS_PER_PAGE);

	const paginatedCampsites = useMemo(() => {
		const start = (currentPage - 1) * ITEMS_PER_PAGE;
		return filteredCampsites.slice(start, start + ITEMS_PER_PAGE);
	}, [filteredCampsites, currentPage]);

	const handleReviewClick = (campsite: CreatedCampsite) => {
		reset();
		setSelectedCampsite(campsite);
	};

	const handleDialogClose = () => {
		if (!isSubmitting) {
			setSelectedCampsite(null);
			reset();
		}
	};

	const handleReviewConfirm = async (values: {
		action: "approve" | "decline";
		reason?: string;
	}) => {
		if (!selectedCampsite) return;

		const result = await submit(selectedCampsite.id, {
			action: values.action,
			reason: values.reason || undefined,
		});

		if (result) {
			// Successful action
			toast.success(
				values.action === "approve"
					? `Đã phê duyệt hoạt động cho khu cắm trại "${selectedCampsite.name}" thành công.`
					: `Đã từ chối và trả khu cắm trại "${selectedCampsite.name}" về bản nháp.`,
				"Phê duyệt hoàn tất"
			);
			setSelectedCampsite(null);
			reset();
			await reload();
		}
	};

	return (
		<AdminLayout activeItem="campsite-review" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<TentTree className="size-7 text-[#164027]" /> Phê duyệt khu cắm trại
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Xem xét các yêu cầu đăng ký xuất bản khu cắm trại của các Host để phê duyệt hoạt động
							hoặc yêu cầu chỉnh sửa.
						</p>
					</div>

					{!isLoading && !listError && campsites.length > 0 && (
						<div className="flex items-center gap-2">
							<label htmlFor="admin-status-filter" className="text-xs font-bold text-[#425048]">
								Trạng thái:
							</label>
							<select
								id="admin-status-filter"
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-bold text-[#164027] focus:border-[#164027] focus:outline-none"
							>
								<option value="all">Tất cả</option>
								<option value="pending">Chờ duyệt</option>
								<option value="approved">Đã duyệt</option>
								<option value="declined">Đã từ chối</option>
							</select>
						</div>
					)}
				</div>

				{listError && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5 shrink-0" />
							<span>{listError}</span>
						</span>
						<button
							type="button"
							onClick={() => {
								void reload();
							}}
							className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white hover:bg-red-800 transition-colors"
						>
							<RefreshCw className="size-4 animate-spin" /> Thử lại
						</button>
					</div>
				)}

				<Card className="overflow-hidden p-0">
					{isLoading ? (
						<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
							<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải danh sách yêu cầu
							phê duyệt...
						</div>
					) : campsites.length === 0 ? (
						<div className="p-16 text-center space-y-3">
							<TentTree className="mx-auto size-12 text-[#9aaba0]" />
							<p className="font-bold text-[#10221b] text-base">Chưa có bãi cắm nào được đăng ký</p>
							<p className="text-sm text-[#667a6d]">
								Hệ thống chưa ghi nhận khu cắm trại nào chờ duyệt, hoạt động hoặc bản nháp.
							</p>
						</div>
					) : filteredCampsites.length === 0 ? (
						<div className="p-16 text-center space-y-3">
							<TentTree className="mx-auto size-12 text-[#9aaba0]" />
							<p className="font-bold text-[#10221b] text-base">Không tìm thấy khu cắm trại</p>
							<p className="text-sm text-[#667a6d]">
								Không có khu cắm trại nào khớp với trạng thái "
								{statusFilter === "pending"
									? "Chờ duyệt"
									: statusFilter === "approved"
										? "Đã duyệt"
										: "Đã từ chối"}
								" được chọn.
							</p>
						</div>
					) : (
						<>
							<AdminCampsitesTable campsites={paginatedCampsites} onReview={handleReviewClick} />
							<div className="flex flex-col gap-3 border-t border-[#e8efe7] px-6 py-4 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between">
								<p>
									Tổng cộng <strong className="text-[#10221b]">{totalCampsites}</strong> khu cắm
									trại
								</p>
								<div className="flex items-center gap-3">
									<button
										type="button"
										aria-label="Trang trước"
										disabled={isLoading || currentPage <= 1}
										onClick={() => setCurrentPage((prev) => prev - 1)}
										className="rounded-lg border border-[#dfe8df] p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
									>
										<ChevronLeft className="size-4" />
									</button>
									<span className="font-semibold text-[#10221b]">
										Trang {currentPage} / {Math.max(totalPages, 1)}
									</span>
									<button
										type="button"
										aria-label="Trang sau"
										disabled={isLoading || currentPage >= totalPages}
										onClick={() => setCurrentPage((prev) => prev + 1)}
										className="rounded-lg border border-[#dfe8df] p-2 disabled:opacity-40 hover:bg-gray-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
									>
										<ChevronRight className="size-4" />
									</button>
								</div>
							</div>
						</>
					)}
				</Card>
			</div>

			<ReviewCampsiteDialog
				open={selectedCampsite !== null}
				campsite={selectedCampsite}
				isSubmitting={isSubmitting}
				errorMessage={actionError ? actionError.message : null}
				onClose={handleDialogClose}
				onConfirm={handleReviewConfirm}
			/>
		</AdminLayout>
	);
}
