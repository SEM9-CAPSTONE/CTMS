import {
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Landmark,
	RefreshCw,
	RotateCcw,
	Search,
	Wallet,
} from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminPayoutsTable } from "../components/AdminPayoutsTable";
import { AdminSettlementsTable } from "../components/AdminSettlementsTable";
import { ConfirmPayoutModal } from "../components/ConfirmPayoutModal";
import { RejectPayoutModal } from "../components/RejectPayoutModal";
import { TripSettlementDetailModal } from "../components/TripSettlementDetailModal";
import { SETTLEMENT_STATUS_TABS } from "../constants";
import {
	useAdminPayouts,
	useAdminSettlements,
	useConfirmPayout,
	useRejectPayout,
	useSettleTrip,
} from "../hooks/useSettlements";
import type { AdminPayoutItem, TripSettlementEvaluation } from "../types";

export interface AdminSettlementsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminSettlementsPage({ onLogout }: AdminSettlementsPageProps) {
	const [activeMainTab, setActiveMainTab] = useState<"settlements" | "payouts">("settlements");
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [searchInput, setSearchInput] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [page, setPage] = useState(1);

	const [confirmPayoutModalItem, setConfirmPayoutModalItem] = useState<AdminPayoutItem | null>(
		null
	);
	const [rejectPayoutModalItem, setRejectPayoutModalItem] = useState<AdminPayoutItem | null>(null);
	const [detailTripItem, setDetailTripItem] = useState<TripSettlementEvaluation | null>(null);
	const [notification, setNotification] = useState<string | null>(null);

	const {
		data: settlementsData,
		isLoading: isSettlementsLoading,
		refetch: refetchSettlements,
		isFetching: isSettlementsFetching,
	} = useAdminSettlements({
		status: statusFilter,
		search: appliedSearch,
		page,
		limit: 15,
	});

	const settleMutation = useSettleTrip();

	const {
		data: payoutsData,
		isLoading: isPayoutsLoading,
		refetch: refetchPayouts,
		isFetching: isPayoutsFetching,
	} = useAdminPayouts({
		status: statusFilter === "all" ? undefined : statusFilter,
		search: appliedSearch,
		page,
		limit: 15,
	});

	const confirmPayoutMutation = useConfirmPayout();
	const rejectPayoutMutation = useRejectPayout();

	const handleSearchSubmit = (e: FormEvent) => {
		e.preventDefault();
		setAppliedSearch(searchInput.trim());
		setPage(1);
	};

	const handleResetFilters = () => {
		setSearchInput("");
		setAppliedSearch("");
		setStatusFilter("all");
		setPage(1);
	};

	const handleSettleTrip = async (tripId: string) => {
		try {
			const res = await settleMutation.mutateAsync(tripId);
			setNotification(
				`Quyết toán thành công chuyến đi #${tripId.slice(0, 8)}. Đã cộng ${res.netAmount} ₫ vào ví Host.`
			);
			void refetchSettlements();
		} catch (err) {
			setNotification(err instanceof Error ? err.message : "Quyết toán thất bại.");
		}
	};

	const handleConfirmPayout = async (
		payoutId: string,
		transactionRef: string,
		adminNotes?: string
	) => {
		try {
			await confirmPayoutMutation.mutateAsync({
				payoutId,
				payload: { transactionRef, adminNotes },
			});
			setConfirmPayoutModalItem(null);
			setNotification(`Đã xác nhận chuyển tiền thành công cho yêu cầu #${payoutId.slice(0, 8)}`);
			void refetchPayouts();
		} catch (err) {
			setNotification(err instanceof Error ? err.message : "Xác nhận chuyển tiền thất bại.");
			throw err;
		}
	};

	const handleRejectPayout = async (payoutId: string, rejectionReason: string) => {
		try {
			await rejectPayoutMutation.mutateAsync({
				payoutId,
				payload: { rejectionReason },
			});
			setRejectPayoutModalItem(null);
			setNotification(`Đã từ chối yêu cầu #${payoutId.slice(0, 8)} và hoàn trả tiền về Ví Host.`);
			void refetchPayouts();
		} catch (err) {
			setNotification(err instanceof Error ? err.message : "Từ chối thất bại.");
			throw err;
		}
	};

	const isRefreshing = isSettlementsFetching || isPayoutsFetching;
	const currentTotal =
		activeMainTab === "settlements"
			? (settlementsData?.total ?? settlementsData?.items.length ?? 0)
			: (payoutsData?.total ?? payoutsData?.items.length ?? 0);
	const currentTotalPages =
		activeMainTab === "settlements"
			? (settlementsData?.totalPages ?? 1)
			: (payoutsData?.totalPages ?? 1);

	return (
		<AdminLayout activeItem="settlements" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<Landmark className="size-7 text-[#164027]" /> Quyết toán & Ví Host
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Đối soát quyết toán chuyến đi hoàn thành (khấu trừ 5% phí sàn) và phê duyệt chuyển
							khoản rút tiền cho Host.
						</p>
					</div>

					<button
						type="button"
						onClick={() => {
							if (activeMainTab === "settlements") void refetchSettlements();
							else void refetchPayouts();
						}}
						disabled={isRefreshing}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-xs font-bold text-[#55685a] shadow-xs hover:bg-[#f6f9f6] hover:text-[#164027] disabled:opacity-50"
					>
						<RefreshCw
							className={`size-3.5 ${isRefreshing ? "animate-spin text-[#164027]" : ""}`}
						/>
						<span>Làm mới</span>
					</button>
				</div>

				{/* Success Banner */}
				{notification && (
					<output className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-xs">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
							<span>{notification}</span>
						</div>
						<button
							type="button"
							onClick={() => setNotification(null)}
							className="text-xs text-emerald-700 hover:underline"
						>
							Đóng
						</button>
					</output>
				)}

				{/* Section Tabs (Quyết toán chuyến đi vs Yêu cầu rút tiền) */}
				<div className="flex border-b border-[#dfe8df]">
					<button
						type="button"
						onClick={() => {
							setActiveMainTab("settlements");
							handleResetFilters();
						}}
						className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
							activeMainTab === "settlements"
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						<Landmark className="size-4" />
						<span>Quyết toán chuyến đi</span>
					</button>

					<button
						type="button"
						onClick={() => {
							setActiveMainTab("payouts");
							handleResetFilters();
						}}
						className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
							activeMainTab === "payouts"
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						<Wallet className="size-4" />
						<span>Yêu cầu rút tiền Ví Host</span>
					</button>
				</div>

				{/* Unified Card Container (Matching AdminUserAccountsPage) */}
				<Card className="overflow-hidden p-0 border border-[#dfe8df] bg-white rounded-2xl shadow-sm">
					{/* Integrated Filter Toolbar */}
					<form
						onSubmit={handleSearchSubmit}
						className="grid gap-3 border-b border-[#e0ebe0] p-4 lg:grid-cols-[1fr_260px_auto_auto]"
					>
						<label className="flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5">
							<Search className="size-4 text-[#788c7e]" />
							<span className="sr-only">Tìm kiếm</span>
							<input
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder={
									activeMainTab === "settlements"
										? "Tên chuyến đi, mã chuyến hoặc tên Host..."
										: "Tên Host, số tài khoản, tên ngân hàng..."
								}
								className="w-full bg-transparent text-sm outline-none"
								maxLength={100}
							/>
						</label>

						<select
							aria-label="Lọc theo trạng thái"
							value={statusFilter}
							onChange={(e) => {
								setStatusFilter(e.target.value);
								setPage(1);
							}}
							className="rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm"
						>
							{(activeMainTab === "settlements"
								? SETTLEMENT_STATUS_TABS
								: [
										{ key: "all", label: "Tất cả trạng thái" },
										{ key: "pending", label: "Chờ chuyển khoản" },
										{ key: "succeeded", label: "Đã chuyển tiền" },
										{ key: "failed", label: "Đã từ chối" },
									]
							).map((opt) => (
								<option key={opt.key} value={opt.key}>
									{opt.label}
								</option>
							))}
						</select>

						<button
							type="submit"
							disabled={isRefreshing}
							className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#11321f] transition disabled:opacity-50"
						>
							Tìm kiếm
						</button>

						<button
							type="button"
							onClick={handleResetFilters}
							disabled={isRefreshing}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dfe8df] px-4 py-2.5 text-sm font-bold text-[#425048] hover:bg-[#f1f5f0] transition disabled:opacity-50"
						>
							<RotateCcw className="size-4" /> Đặt lại
						</button>
					</form>

					{/* Table Content */}
					{activeMainTab === "settlements" ? (
						<AdminSettlementsTable
							items={settlementsData?.items || []}
							isLoading={isSettlementsLoading}
							isSettling={settleMutation.isPending}
							onSettle={handleSettleTrip}
							onViewTrip={setDetailTripItem}
						/>
					) : (
						<AdminPayoutsTable
							items={payoutsData?.items || []}
							isLoading={isPayoutsLoading}
							onOpenConfirmModal={setConfirmPayoutModalItem}
							onOpenRejectModal={setRejectPayoutModalItem}
						/>
					)}

					{/* Integrated Pagination Bar */}
					<div className="flex flex-col gap-3 border-t border-[#e0ebe0] px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between bg-white">
						<p>
							Tổng cộng <strong className="text-[#10221b]">{currentTotal}</strong>{" "}
							{activeMainTab === "settlements" ? "chuyến đi" : "yêu cầu rút tiền"}
						</p>
						<div className="flex items-center gap-3">
							<button
								type="button"
								aria-label="Trang trước"
								disabled={isRefreshing || page <= 1}
								onClick={() => setPage(page - 1)}
								className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronLeft className="size-4" />
							</button>
							<span>
								Trang {page} / {Math.max(currentTotalPages, 1)}
							</span>
							<button
								type="button"
								aria-label="Trang sau"
								disabled={isRefreshing || page >= currentTotalPages}
								onClick={() => setPage(page + 1)}
								className="rounded-lg border border-[#dfe8df] p-2 hover:bg-[#f1f5f0] disabled:cursor-not-allowed disabled:opacity-40"
							>
								<ChevronRight className="size-4" />
							</button>
						</div>
					</div>
				</Card>
			</div>

			{/* Confirm Payout Modal */}
			<ConfirmPayoutModal
				payout={confirmPayoutModalItem}
				isSubmitting={confirmPayoutMutation.isPending}
				onClose={() => setConfirmPayoutModalItem(null)}
				onConfirm={handleConfirmPayout}
			/>

			{/* Reject Payout Modal */}
			<RejectPayoutModal
				payout={rejectPayoutModalItem}
				isSubmitting={rejectPayoutMutation.isPending}
				onClose={() => setRejectPayoutModalItem(null)}
				onReject={handleRejectPayout}
			/>

			{/* Trip Settlement Detail Modal */}
			<TripSettlementDetailModal
				item={detailTripItem}
				isOpen={Boolean(detailTripItem)}
				onClose={() => setDetailTripItem(null)}
				onSettle={handleSettleTrip}
				isSettling={settleMutation.isPending}
			/>
		</AdminLayout>
	);
}
