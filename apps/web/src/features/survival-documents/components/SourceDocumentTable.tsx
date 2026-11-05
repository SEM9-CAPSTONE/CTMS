import { Eye } from "lucide-react";
import { DataTable, Pagination } from "../../../shared/components";
import { CATEGORY_LABELS, SOURCE_PAGE_SIZE } from "../constants";
import type { DocumentListItem } from "../types";
export function SourceDocumentTable({
	items,
	total,
	page,
	disabled,
	onOpen,
	onPage,
}: {
	items: DocumentListItem[];
	total: number;
	page: number;
	disabled: boolean;
	onOpen: (id: string) => void;
	onPage: (page: number) => void;
}) {
	return (
		<>
			<DataTable
				rows={items}
				getRowKey={(item) => item.id}
				ariaLabel="Danh sách tài liệu sinh tồn"
				emptyMessage="Chưa có tài liệu phù hợp."
				columns={[
					{
						key: "name",
						header: "Tài liệu",
						render: (item) => (
							<span className="font-bold">{item.latestVersion.metadata.sourceTitle}</span>
						),
					},
					{
						key: "publisher",
						header: "Tổ chức",
						render: (item) => item.latestVersion.metadata.publisher || "—",
					},
					{
						key: "classification",
						header: "Phân loại",
						render: (item) => CATEGORY_LABELS[item.latestVersion.metadata.classification],
					},
					{
						key: "locale",
						header: "Ngôn ngữ",
						render: (item) => item.latestVersion.metadata.locale,
					},
					{
						key: "published",
						header: "Đang xuất bản",
						render: (item) =>
							item.publishedVersionNumber ? `Phiên bản ${item.publishedVersionNumber}` : "Chưa có",
					},
					{
						key: "updated",
						header: "Cập nhật",
						render: (item) => new Date(item.updatedAt).toLocaleDateString("vi-VN"),
					},
					{
						key: "detail",
						header: "Chi tiết",
						render: (item) => (
							<button
								type="button"
								disabled={disabled}
								aria-label={`Xem ${item.latestVersion.metadata.sourceTitle}`}
								onClick={() => onOpen(item.id)}
								className="rounded-lg p-2 text-[#164027]"
							>
								<Eye className="size-5" />
							</button>
						),
					},
				]}
			/>
			<Pagination
				currentPage={page}
				totalPages={Math.ceil(total / SOURCE_PAGE_SIZE)}
				totalItems={total}
				itemsPerPage={SOURCE_PAGE_SIZE}
				onPageChange={onPage}
			/>
		</>
	);
}
