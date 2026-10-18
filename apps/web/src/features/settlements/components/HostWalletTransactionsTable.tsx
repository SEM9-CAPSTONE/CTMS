import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, History } from "lucide-react";
import { useState } from "react";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { TRANSACTION_TYPE_LABELS } from "../constants";
import type { WalletTransactionItem } from "../types";

export interface HostWalletTransactionsTableProps {
	transactions: WalletTransactionItem[];
	pageSize?: number;
}

export function HostWalletTransactionsTable({
	transactions,
	pageSize = 10,
}: HostWalletTransactionsTableProps) {
	const [currentPage, setCurrentPage] = useState(1);

	const totalItems = transactions.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const safePage = Math.min(Math.max(currentPage, 1), totalPages);

	const startIndex = (safePage - 1) * pageSize;
	const endIndex = Math.min(startIndex + pageSize, totalItems);
	const paginatedTransactions = transactions.slice(startIndex, endIndex);

	const handlePageChange = (newPage: number) => {
		if (newPage >= 1 && newPage <= totalPages) {
			setCurrentPage(newPage);
		}
	};

	const getPageNumbers = () => {
		if (totalPages <= 5) {
			return Array.from({ length: totalPages }, (_, i) => i + 1);
		}
		if (safePage <= 3) {
			return [1, 2, 3, 4, totalPages];
		}
		if (safePage >= totalPages - 2) {
			return [1, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
		}
		return [1, safePage - 1, safePage, safePage + 1, totalPages];
	};

	return (
		<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
			<div className="flex items-center justify-between border-b border-[#e7eee7] pb-4">
				<div className="flex items-center gap-2.5">
					<History className="size-5 text-[#164027]" />
					<h2 className="text-base font-extrabold text-[#10221b]">Lịch sử biến động số dư</h2>
				</div>
				<span className="text-xs font-semibold text-[#667a6d]">{totalItems} giao dịch</span>
			</div>

			{totalItems === 0 ? (
				<div className="py-12 text-center text-xs text-[#667a6d]">
					Chưa có biến động số dư nào trong ví của bạn.
				</div>
			) : (
				<>
					<div className="mt-4 overflow-x-auto">
						<table className="w-full text-left text-xs">
							<thead>
								<tr className="border-b border-[#edf3ed] text-[11px] font-bold uppercase tracking-wider text-[#7d8d83]">
									<th className="py-3 px-3">Thời gian</th>
									<th className="py-3 px-3">Loại giao dịch</th>
									<th className="py-3 px-3">Mô tả</th>
									<th className="py-3 px-3 text-right">Biến động</th>
									<th className="py-3 px-3 text-right">Số dư sau GD</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-[#f1f5f0]">
								{paginatedTransactions.map((t) => {
									const typeInfo = TRANSACTION_TYPE_LABELS[t.type] || {
										label: t.type,
										tone: "blue" as const,
									};
									const isPositive = Number(t.netAmount) > 0;

									return (
										<tr key={t.id} className="hover:bg-[#fafcfa]">
											<td className="py-3.5 px-3 text-[#52665b] whitespace-nowrap">
												{new Date(t.createdAt).toLocaleString("vi-VN")}
											</td>
											<td className="py-3.5 px-3 whitespace-nowrap">
												<span
													className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${
														typeInfo.tone === "green"
															? "bg-emerald-50 text-emerald-800"
															: typeInfo.tone === "rose"
																? "bg-rose-50 text-rose-800"
																: "bg-sky-50 text-sky-800"
													}`}
												>
													{isPositive ? (
														<ArrowUpRight className="size-3" />
													) : (
														<ArrowDownRight className="size-3" />
													)}
													{typeInfo.label}
												</span>
											</td>
											<td className="py-3.5 px-3 text-[#10221b] max-w-xs truncate">
												{t.description}
											</td>
											<td className="py-3.5 px-3 text-right font-black whitespace-nowrap">
												<span className={isPositive ? "text-emerald-700" : "text-rose-700"}>
													{isPositive ? "+" : ""}
													{formatBookingMoney(t.netAmount)}
												</span>
											</td>
											<td className="py-3.5 px-3 text-right font-bold text-[#10221b] whitespace-nowrap">
												{formatBookingMoney(t.balanceAfter)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Pagination Controls */}
					<div className="mt-4 flex flex-col gap-3 border-t border-[#edf3ed] pt-4 text-xs text-[#52665b] sm:flex-row sm:items-center sm:justify-between">
						<p>
							Hiển thị{" "}
							<strong>
								{startIndex + 1}–{endIndex}
							</strong>{" "}
							trên tổng số <strong>{totalItems}</strong> giao dịch
						</p>

						<div className="flex items-center gap-1.5">
							<button
								type="button"
								aria-label="Trang trước"
								disabled={safePage <= 1}
								onClick={() => handlePageChange(safePage - 1)}
								className="inline-flex items-center gap-1 rounded-xl border border-[#dfe8df] bg-white px-3 py-1.5 font-bold text-[#55685a] hover:bg-[#f4f7f2] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
							>
								<ChevronLeft className="size-4" />
								<span>Trước</span>
							</button>

							<div className="flex items-center gap-1">
								{getPageNumbers().map((pageNum, idx, arr) => {
									const showEllipsisBefore = idx > 0 && pageNum - (arr[idx - 1] ?? 0) > 1;
									return (
										<div key={pageNum} className="flex items-center gap-1">
											{showEllipsisBefore && (
												<span className="px-1 font-semibold text-[#7d8d83]">...</span>
											)}
											<button
												type="button"
												aria-label={`Trang ${pageNum}`}
												onClick={() => handlePageChange(pageNum)}
												className={`flex size-8 items-center justify-center rounded-xl text-xs font-bold transition-all ${
													safePage === pageNum
														? "bg-[#164027] text-white shadow-xs"
														: "border border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f4f7f2]"
												}`}
											>
												{pageNum}
											</button>
										</div>
									);
								})}
							</div>

							<button
								type="button"
								aria-label="Trang sau"
								disabled={safePage >= totalPages}
								onClick={() => handlePageChange(safePage + 1)}
								className="inline-flex items-center gap-1 rounded-xl border border-[#dfe8df] bg-white px-3 py-1.5 font-bold text-[#55685a] hover:bg-[#f4f7f2] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
							>
								<span>Sau</span>
								<ChevronRight className="size-4" />
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
