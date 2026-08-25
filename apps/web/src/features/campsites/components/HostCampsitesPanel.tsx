import { Loader2, MapPinned, Route, TentTree } from "lucide-react";
import { useMemo, useState } from "react";
import { Button, Pagination } from "../../../shared/components";
import { CampsiteStatus } from "../types";
import type { CreatedCampsite } from "../types";

export const campsiteStatusLabels: Record<CreatedCampsite["status"], string> = {
	draft: "Nháp",
	pending_approval: "Chờ Admin duyệt",
	active: "Đang hoạt động",
	temporarily_closed: "Tạm đóng",
	suspended: "Tạm khóa",
	closed: "Đã đóng",
	archived: "Lưu trữ",
};

function formatCreatedAt(value: string): string {
	return new Intl.DateTimeFormat("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(new Date(value));
}

export interface HostCampsitesPanelProps {
	items: CreatedCampsite[];
	isLoading: boolean;
	error: string;
	onCreateCampsite?: () => void;
	onEditCampsite?: (id: string) => void;
	onManageImages?: (campsite: CreatedCampsite) => void;
	onCreateTrekkingRoute?: (campsiteId?: string) => void;
	onViewTrekkingRoutes?: (campsiteId: string) => void;
}

export function HostCampsitesPanel({
	items,
	isLoading,
	error,
	onCreateCampsite,
	onEditCampsite,
	onManageImages,
	onCreateTrekkingRoute,
	onViewTrekkingRoutes,
}: HostCampsitesPanelProps) {
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [currentPage, setCurrentPage] = useState<number>(1);
	const itemsPerPage = 5;

	const filteredItems = useMemo(() => {
		if (statusFilter === "all") {
			return items;
		}
		return items.filter((item) => item.status === statusFilter);
	}, [items, statusFilter]);

	const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

	const paginatedItems = useMemo(() => {
		const startIndex = (currentPage - 1) * itemsPerPage;
		return filteredItems.slice(startIndex, startIndex + itemsPerPage);
	}, [filteredItems, currentPage]);

	return (
		<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-extrabold text-[#10221b]">Khu cắm trại của tôi</h2>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					{!isLoading && !error && items.length > 0 && (
						<div className="flex items-center gap-2">
							<label htmlFor="status-filter" className="text-xs font-bold text-[#425048]">
								Trạng thái:
							</label>
							<select
								id="status-filter"
								value={statusFilter}
								onChange={(e) => {
									setStatusFilter(e.target.value);
									setCurrentPage(1);
								}}
								className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-xs font-bold text-[#164027] focus:border-[#164027] focus:outline-none"
							>
								<option value="all">Tất cả trạng thái</option>
								{Object.entries(campsiteStatusLabels).map(([key, value]) => (
									<option key={key} value={key}>
										{value}
									</option>
								))}
							</select>
						</div>
					)}
					{onCreateCampsite && (
						<Button onClick={onCreateCampsite} className="gap-2">
							<TentTree className="size-4" />
							<span>Tạo khu cắm trại</span>
						</Button>
					)}
				</div>
			</div>

			{isLoading && (
				<div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-4 text-sm font-bold text-[#667a6d]">
					<Loader2 className="size-4 animate-spin text-[#164027]" />
					Đang tải dữ liệu...
				</div>
			)}

			{error && !isLoading && (
				<div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
					{error}
				</div>
			)}

			{!isLoading && !error && items.length === 0 && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9ce] bg-[#fbfdfb] p-6 text-center">
					<TentTree className="mx-auto size-8 text-[#8fa096]" />
					<p className="mt-2 text-sm font-extrabold text-[#10221b]">Chưa có bãi cắm nào</p>
					<p className="mt-1 text-xs font-semibold text-[#788b7e]">
						Bãi vừa tạo sẽ xuất hiện ở đây với trạng thái chờ duyệt.
					</p>
				</div>
			)}

			{!isLoading && !error && items.length > 0 && filteredItems.length === 0 && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9ce] bg-[#fbfdfb] p-6 text-center">
					<TentTree className="mx-auto size-8 text-[#8fa096]" />
					<p className="mt-2 text-sm font-extrabold text-[#10221b]">Không tìm thấy khu cắm trại</p>
					<p className="mt-1 text-xs font-semibold text-[#788b7e]">
						Không có bãi cắm nào khớp với bộ lọc trạng thái đã chọn.
					</p>
				</div>
			)}

			{!isLoading && !error && paginatedItems.length > 0 && (
				<div className="mt-5 overflow-x-auto rounded-2xl border border-[#e5eee7]">
					<table className="w-full border-collapse text-left text-sm font-sans">
						<thead>
							<tr className="border-b border-[#e5eee7] bg-[#f8faf7] text-xs font-bold uppercase tracking-wider text-[#425048]">
								<th className="px-5 py-4">Tên khu cắm trại</th>
								<th className="px-5 py-4">Tọa độ</th>
								<th className="px-5 py-4">Ngày tạo</th>
								<th className="px-5 py-4 text-center">Trạng thái</th>
								<th className="px-5 py-4 text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-[#e5eee7]">
							{paginatedItems.map((campsite) => {
								let statusBadgeTone = "bg-amber-50 text-amber-700 border border-amber-200/50";
								if (campsite.status === CampsiteStatus.ACTIVE) {
									statusBadgeTone = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
								} else if (
									campsite.status === CampsiteStatus.CLOSED ||
									campsite.status === CampsiteStatus.SUSPENDED
								) {
									statusBadgeTone = "bg-red-50 text-red-700 border border-red-200/50";
								}

								return (
									<tr key={campsite.id} className="bg-white hover:bg-[#fbfdfb] transition-colors">
										<td className="px-5 py-4 font-bold text-[#10221b]">
											<div>
												<span className="block text-[#164027]">{campsite.name}</span>
												<span className="block text-xs font-semibold text-[#667a6d] mt-0.5">
													{campsite.province}
												</span>
											</div>
										</td>
										<td className="px-5 py-4 font-mono text-xs text-[#55685a]">
											{campsite.latitude.toFixed(6)}, {campsite.longitude.toFixed(6)}
										</td>
										<td className="px-5 py-4 text-xs font-semibold text-[#667a6d]">
											{formatCreatedAt(campsite.createdAt)}
										</td>
										<td className="px-5 py-4 text-center">
											<span
												className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold ${statusBadgeTone}`}
											>
												{campsiteStatusLabels[campsite.status]}
											</span>
										</td>
										<td className="px-5 py-4 text-right">
											<div className="flex items-center justify-end gap-2">
												{onEditCampsite && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onEditCampsite(campsite.id)}
														className="text-xs"
													>
														Sửa khu cắm trại
													</Button>
												)}
												{onManageImages && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onManageImages(campsite)}
														data-testid={`manage-images-btn-${campsite.id}`}
														className="text-xs"
													>
														Quản lý ảnh
													</Button>
												)}
												{onCreateTrekkingRoute && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onCreateTrekkingRoute(campsite.id)}
														className="text-xs gap-1.5"
													>
														<Route className="size-3.5" />
														<span>Tạo trekking route</span>
													</Button>
												)}
												{onViewTrekkingRoutes && (
													<Button
														type="button"
														variant="outline"
														size="sm"
														onClick={() => onViewTrekkingRoutes(campsite.id)}
														className="text-xs gap-1.5"
													>
														<MapPinned className="size-3.5" />
														<span>Xem tuyến đường</span>
													</Button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			{!isLoading && !error && filteredItems.length > 0 && (
				<Pagination
					currentPage={currentPage}
					totalPages={totalPages}
					totalItems={filteredItems.length}
					itemsPerPage={itemsPerPage}
					onPageChange={setCurrentPage}
				/>
			)}
		</section>
	);
}
