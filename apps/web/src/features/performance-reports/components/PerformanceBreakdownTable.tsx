import { Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
	Card,
	DataTable,
	type DataTableColumn,
	Pagination,
	StatusBadge,
	type StatusBadgeTone,
} from "../../../shared/components";
import { TRIP_STATUS_LABELS } from "../constants";
import type { PerformanceTripBreakdown } from "../types";

interface PerformanceBreakdownTableProps {
	items: PerformanceTripBreakdown[];
}

function formatVnd(value: number): string {
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

function getStatusTone(status: string): StatusBadgeTone {
	switch (status) {
		case "completed":
			return "success";
		case "ongoing":
			return "info";
		case "published":
			return "neutral";
		case "cancelled":
		case "rejected":
			return "danger";
		default:
			return "neutral";
	}
}

const columns: DataTableColumn<PerformanceTripBreakdown>[] = [
	{
		key: "trip",
		header: "Chuyến đi & Tuyến",
		align: "left",
		render: (item) => (
			<div>
				<div className="font-semibold text-gray-900">{item.title}</div>
				{item.routeName && <div className="text-xs text-gray-500">{item.routeName}</div>}
			</div>
		),
	},
	{
		key: "status",
		header: "Trạng thái",
		align: "left",
		render: (item) => (
			<StatusBadge tone={getStatusTone(item.status)}>
				{TRIP_STATUS_LABELS[item.status] ?? item.status}
			</StatusBadge>
		),
	},
	{
		key: "bookingCount",
		header: "Đơn đặt",
		align: "center",
		render: (item) => <span className="font-medium text-gray-800">{item.bookingCount}</span>,
	},
	{
		key: "capacity",
		header: "Chỗ / Sức chứa",
		align: "center",
		render: (item) => (
			<span className="font-medium text-gray-800">
				{item.seatsTaken} / {item.capacity}
			</span>
		),
	},
	{
		key: "fillRate",
		header: "Lấp đầy",
		align: "center",
		render: (item) => (
			<span
				className={`font-semibold ${
					item.fillRate >= 80
						? "text-emerald-700"
						: item.fillRate >= 50
							? "text-amber-700"
							: "text-gray-600"
				}`}
			>
				{item.fillRate}%
			</span>
		),
	},
	{
		key: "cancellationRate",
		header: "Tỷ lệ hủy",
		align: "center",
		render: (item) => (
			<span
				className={item.cancellationRate > 20 ? "text-rose-600 font-semibold" : "text-gray-600"}
			>
				{item.cancellationRate}%
			</span>
		),
	},
	{
		key: "estimatedRevenue",
		header: "Doanh thu dự kiến",
		align: "right",
		render: (item) => (
			<div className="font-medium text-gray-900">{formatVnd(item.estimatedRevenue)}</div>
		),
	},
	{
		key: "actualRevenue",
		header: "Doanh thu thực tế",
		align: "right",
		render: (item) => (
			<div className="font-semibold text-emerald-800">{formatVnd(item.actualRevenue)}</div>
		),
	},
];

export const PerformanceBreakdownTable: React.FC<PerformanceBreakdownTableProps> = ({ items }) => {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 8;

	const filteredItems = useMemo(() => {
		if (!search.trim()) return items;
		const q = search.toLowerCase();
		return items.filter(
			(i) => i.title.toLowerCase().includes(q) || Boolean(i.routeName?.toLowerCase().includes(q))
		);
	}, [items, search]);

	const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
	const currentItems = useMemo(() => {
		const start = (page - 1) * pageSize;
		return filteredItems.slice(start, start + pageSize);
	}, [filteredItems, page]);

	return (
		<Card className="flex flex-col gap-4 p-5">
			{/* Header & Local Search */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h3 className="text-sm font-bold text-gray-900">Chi tiết hiệu suất theo chuyến đi</h3>

				<div className="relative w-full sm:w-64">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
					<input
						type="text"
						placeholder="Tìm chuyến hoặc tuyến..."
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-3 pl-8 text-xs text-gray-800 outline-hidden focus:border-emerald-600 focus:bg-white"
					/>
				</div>
			</div>

			{/* System DataTable */}
			<DataTable<PerformanceTripBreakdown>
				columns={columns}
				rows={currentItems}
				getRowKey={(row) => row.id}
				ariaLabel="Bảng chi tiết hiệu suất chuyến đi"
				emptyMessage="Không có dữ liệu chuyến đi nào phù hợp"
			/>

			{/* System Pagination */}
			<Pagination
				currentPage={page}
				totalPages={totalPages}
				totalItems={filteredItems.length}
				itemsPerPage={pageSize}
				onPageChange={setPage}
			/>
		</Card>
	);
};
