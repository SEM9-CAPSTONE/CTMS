import { Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import {
	Card,
	DataTable,
	type DataTableColumn,
	Pagination,
	StatusBadge,
} from "../../../shared/components";
import { formatVnd } from "../../../shared/utils/money";
import type { RevenueTripBreakdown } from "../types";

const SETTLEMENT_FILTERS = [
	{ key: "all", label: "Tất cả" },
	{ key: "settled", label: "Đã quyết toán" },
	{ key: "unsettled", label: "Chưa quyết toán" },
] as const;

type SettlementFilter = (typeof SETTLEMENT_FILTERS)[number]["key"];

function matchesSettlement(trip: RevenueTripBreakdown, filter: SettlementFilter): boolean {
	switch (filter) {
		case "settled":
			return Boolean(trip.settledAt);
		case "unsettled":
			return !trip.settledAt;
		default:
			return true;
	}
}

const columns: DataTableColumn<RevenueTripBreakdown>[] = [
	{
		key: "trip",
		header: "Chuyến đi",
		align: "left",
		render: (trip) => <span className="font-semibold text-gray-900">{trip.title}</span>,
	},
	{
		key: "settlement",
		header: "Quyết toán",
		align: "left",
		render: (trip) =>
			trip.settledAt ? (
				<StatusBadge tone="success">Đã quyết toán</StatusBadge>
			) : (
				<StatusBadge tone="warning">Chưa quyết toán</StatusBadge>
			),
	},
	{
		key: "bookingCount",
		header: "Đơn đã thanh toán",
		align: "center",
		render: (trip) => <span className="font-medium text-gray-800">{trip.bookingCount}</span>,
	},
	{
		key: "grossRevenue",
		header: "Tổng tiền khách trả",
		align: "right",
		render: (trip) => formatVnd(trip.grossRevenue),
	},
	{
		key: "refundAmount",
		header: "Tiền đã hoàn",
		align: "right",
		render: (trip) => formatVnd(trip.refundAmount),
	},
	{
		key: "platformFee",
		header: "Phí nền tảng",
		align: "right",
		render: (trip) => formatVnd(trip.platformFee),
	},
	{
		key: "netRevenue",
		header: "Thu nhập sau phí",
		align: "right",
		render: (trip) => (
			<span className="font-semibold text-[#164027]">{formatVnd(trip.netRevenue)}</span>
		),
	},
	{
		key: "heldFunds",
		header: "Tiền chưa quyết toán",
		align: "right",
		render: (trip) => formatVnd(trip.heldFunds),
	},
];

const PAGE_SIZE = 8;

export const RevenueByTripTable: React.FC<{ trips: RevenueTripBreakdown[] }> = ({ trips }) => {
	const [search, setSearch] = useState("");
	const [settlement, setSettlement] = useState<SettlementFilter>("all");
	const [page, setPage] = useState(1);

	const filtered = useMemo(() => {
		const query = search.trim().toLowerCase();
		return trips.filter(
			(trip) =>
				matchesSettlement(trip, settlement) && (!query || trip.title.toLowerCase().includes(query))
		);
	}, [trips, search, settlement]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	return (
		<Card className="flex flex-col gap-4 p-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h3 className="text-sm font-bold text-gray-900">Chi tiết theo chuyến đi</h3>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
					<div className="flex flex-wrap items-center gap-1.5">
						{SETTLEMENT_FILTERS.map((option) => {
							const selected = settlement === option.key;
							return (
								<button
									key={option.key}
									type="button"
									aria-pressed={selected}
									onClick={() => {
										setSettlement(option.key);
										setPage(1);
									}}
									className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
										selected
											? "bg-[#164027] text-white shadow-xs"
											: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2] hover:text-[#164027]"
									}`}
								>
									{option.label}
								</button>
							);
						})}
					</div>
					<div className="relative w-full sm:w-64">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
						<input
							type="text"
							aria-label="Tìm chuyến đi"
							placeholder="Tìm chuyến đi..."
							value={search}
							onChange={(event) => {
								setSearch(event.target.value);
								setPage(1);
							}}
							className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pr-3 pl-8 text-xs text-gray-800 outline-hidden focus:border-emerald-600 focus:bg-white"
						/>
					</div>
				</div>
			</div>
			<DataTable<RevenueTripBreakdown>
				columns={columns}
				rows={rows}
				getRowKey={(trip) => trip.tripId}
				ariaLabel="Bảng doanh thu theo chuyến đi"
				emptyMessage="Không có chuyến đi phù hợp"
				minWidthClassName="min-w-[960px]"
			/>
			<Pagination
				currentPage={page}
				totalPages={totalPages}
				totalItems={filtered.length}
				itemsPerPage={PAGE_SIZE}
				onPageChange={setPage}
			/>
		</Card>
	);
};
