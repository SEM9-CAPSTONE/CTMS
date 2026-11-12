import {
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Landmark,
	ReceiptText,
	RefreshCw,
	RotateCcw,
	Search,
	Wallet,
} from "lucide-react";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { Card } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminRefundsTable } from "../../admin-refunds/components/AdminRefundsTable";
import { ConfirmTransferModal } from "../../admin-refunds/components/ConfirmTransferModal";
import { RefundDetailsModal } from "../../admin-refunds/components/RefundDetailsModal";
import { RejectRefundModal } from "../../admin-refunds/components/RejectRefundModal";
import { ADMIN_REFUND_STATUS_TABS } from "../../admin-refunds/constants";
import { useAdminRefunds } from "../../admin-refunds/hooks/useAdminRefunds";
import type { AdminRefundFilter, AdminRefundItem } from "../../admin-refunds/types";
import type { PaymentStatus } from "../../booking-refund/types";
import { AdminPayoutDetailModal } from "../components/AdminPayoutDetailModal";
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

export type AdminSettlementTab = "settlements" | "payouts" | "refunds";

export interface AdminSettlementsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
	initialTab?: AdminSettlementTab;
}

export function AdminSettlementsPage({ onLogout, initialTab }: AdminSettlementsPageProps) {
	const getInitialTab = (): AdminSettlementTab => {
		if (initialTab) return initialTab;
		if (typeof window !== "undefined") {
			const searchParams = new URLSearchParams(window.location.search);
			const tab = searchParams.get("tab");
			if (tab === "refunds" || tab === "payouts" || tab === "settlements") {
				return tab;
			}
		}
		return "settlements";
	};

	const [activeMainTab, setActiveMainTab] = useState<AdminSettlementTab>(getInitialTab);
	const [statusFilter, setStatusFilter] = useState<string>("all");
	const [searchInput, setSearchInput] = useState("");
	const [appliedSearch, setAppliedSearch] = useState("");
	const [page, setPage] = useState(1);

	const [confirmPayoutModalItem, setConfirmPayoutModalItem] = useState<AdminPayoutItem | null>(
		null
	);
	const [rejectPayoutModalItem, setRejectPayoutModalItem] = useState<AdminPayoutItem | null>(null);
	const [detailTripItem, setDetailTripItem] = useState<TripSettlementEvaluation | null>(null);
	const [detailPayoutItem, setDetailPayoutItem] = useState<AdminPayoutItem | null>(null);

	const [selectedRefundForDetail, setSelectedRefundForDetail] = useState<AdminRefundItem | null>(
		null
	);
	const [selectedRefundForConfirm, setSelectedRefundForConfirm] = useState<AdminRefundItem | null>(
		null
	);
	const [selectedRefundForReject, setSelectedRefundForReject] = useState<AdminRefundItem | null>(
		null
	);

	const [notification, setNotification] = useState<string | null>(null);

	const {
		data: settlementsData,
		isLoading: isSettlementsLoading,
		refetch: refetchSettlements,
		isFetching: isSettlementsFetching,
	} = useAdminSettlements(
		{
			status: statusFilter,
			search: appliedSearch,
			page,
			limit: 15,
		},
		activeMainTab === "settlements"
	);

	const settleMutation = useSettleTrip();

	const {
		data: payoutsData,
		isLoading: isPayoutsLoading,
		refetch: refetchPayouts,
		isFetching: isPayoutsFetching,
	} = useAdminPayouts(
		{
			status: statusFilter === "all" ? undefined : statusFilter,
			search: appliedSearch,
			page,
			limit: 15,
		},
		activeMainTab === "payouts"
	);

	const confirmPayoutMutation = useConfirmPayout();
	const rejectPayoutMutation = useRejectPayout();

	const refundFilter = useMemo<AdminRefundFilter>(
		() => ({
			page,
			limit: 15,
			status: statusFilter === "all" ? undefined : (statusFilter as PaymentStatus),
			search: appliedSearch.trim() || undefined,
		}),
		[page, statusFilter, appliedSearch]
	);

	const {
		refundsData,
		isLoading: isRefundsLoading,
		isError: isRefundsError,
		error: refundsError,
		refetch: refetchRefunds,
		confirmTransfer: confirmRefundTransfer,
		isConfirming: isConfirmingRefund,
		rejectRefund: rejectRefundTransfer,
		isRejecting: isRejectingRefund,
	} = useAdminRefunds(refundFilter, activeMainTab === "refunds");

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

	const handleTabChange = (tab: AdminSettlementTab) => {
		setActiveMainTab(tab);
		setSearchInput("");
		setAppliedSearch("");
		setStatusFilter("all");
		setPage(1);
		if (typeof window !== "undefined") {
			const url = new URL(window.location.href);
			if (tab === "settlements") {
				url.searchParams.delete("tab");
			} else {
				url.searchParams.set("tab", tab);
			}
			window.history.replaceState({}, "", url.pathname + url.search);
		}
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

	const handleConfirmRefund = async (obligationId: string, note?: string) => {
		try {
			await confirmRefundTransfer({
				obligationId,
				payload: {
					transactionRef: `MANUAL-${Date.now()}`,
					note,
				},
			});
			setSelectedRefundForConfirm(null);
			setNotification(
				`Đã xác nhận chuyển tiền thành công cho yêu cầu #${obligationId.slice(0, 8)}`
			);
			void refetchRefunds();
		} catch (err) {
			setNotification(err instanceof Error ? err.message : "Xác nhận chuyển tiền thất bại.");
			throw err;
		}
	};

	const handleRejectRefund = async (obligationId: string, rejectionReason: string) => {
		try {
			await rejectRefundTransfer({
				obligationId,
				payload: { rejectionReason },
			});
			setSelectedRefundForReject(null);
			setNotification(`Đã từ chối yêu cầu hoàn tiền #${obligationId.slice(0, 8)}`);
			void refetchRefunds();
		} catch (err) {
			setNotification(err instanceof Error ? err.message : "Từ chối hoàn tiền thất bại.");
			throw err;
		}
	};

	const isRefreshing =
		activeMainTab === "settlements"
			? isSettlementsFetching
			: activeMainTab === "payouts"
				? isPayoutsFetching
				: isRefundsLoading;

	const handleRefresh = () => {
		if (activeMainTab === "settlements") {
			void refetchSettlements();
		} else if (activeMainTab === "payouts") {
			void refetchPayouts();
		} else {
			void refetchRefunds();
		}
	};

	const currentTotal =
		activeMainTab === "settlements"
			? (settlementsData?.total ?? settlementsData?.items.length ?? 0)
			: activeMainTab === "payouts"
				? (payoutsData?.total ?? payoutsData?.items.length ?? 0)
				: (refundsData?.total ?? refundsData?.items.length ?? 0);

	const currentTotalPages =
		activeMainTab === "settlements"
			? (settlementsData?.totalPages ?? 1)
			: activeMainTab === "payouts"
				? (payoutsData?.totalPages ?? 1)
				: (refundsData?.totalPages ?? 1);

	return (
		<AdminLayout activeItem="settlements" onLogout={onLogout}>
			<div className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				{/* Page Header */}
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="flex items-center gap-3 text-2xl font-extrabold text-[#10221b]">
							<Landmark className="size-7 text-[#164027]" /> Quản lý tài chính
						</h1>
						<p className="mt-1 text-sm text-[#667a6d]">
							Đối soát hoàn tiền cho Camper, quyết toán chuyến đi hoàn thành (khấu trừ 5% phí sàn)
							và phê duyệt chuyển khoản rút tiền cho Host.
						</p>
					</div>

					<button
						type="button"
						onClick={handleRefresh}
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

				{/* Error Banner for refunds */}
				{activeMainTab === "refunds" && isRefundsError && (
					<div
						role="alert"
						className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-900"
					>
						<span>{refundsError?.message || "Không thể tải danh sách yêu cầu hoàn tiền."}</span>
						<button
							type="button"
							onClick={() => void refetchRefunds()}
							className="rounded-lg bg-rose-700 px-3 py-1.5 font-bold text-white hover:bg-rose-800"
						>
							Thử lại
						</button>
					</div>
				)}

				{/* Section Tabs (Quyết toán chuyến đi, Yêu cầu rút tiền Ví Host, Hoàn tiền Camper) */}
				<div className="flex border-b border-[#dfe8df]">
					<button
						type="button"
						onClick={() => handleTabChange("settlements")}
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
						onClick={() => handleTabChange("payouts")}
						className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
							activeMainTab === "payouts"
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						<Wallet className="size-4" />
						<span>Yêu cầu rút tiền Ví Host</span>
					</button>

					<button
						type="button"
						onClick={() => handleTabChange("refunds")}
						className={`inline-flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-bold transition ${
							activeMainTab === "refunds"
								? "border-[#164027] text-[#164027]"
								: "border-transparent text-[#667a6d] hover:text-[#10221b]"
						}`}
					>
						<ReceiptText className="size-4" />
						<span>Hoàn tiền Camper</span>
					</button>
				</div>

				{/* Unified Card Container */}
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
										: activeMainTab === "payouts"
											? "Tên Host, số tài khoản, tên ngân hàng..."
											: "Tên Camper, email, mã đơn..."
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
								: activeMainTab === "payouts"
									? [
											{ key: "all", label: "Tất cả trạng thái" },
											{ key: "pending", label: "Chờ chuyển khoản" },
											{ key: "succeeded", label: "Đã chuyển tiền" },
											{ key: "failed", label: "Đã từ chối" },
										]
									: ADMIN_REFUND_STATUS_TABS
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
					{activeMainTab === "settlements" && (
						<AdminSettlementsTable
							items={settlementsData?.items || []}
							isLoading={isSettlementsLoading}
							isSettling={settleMutation.isPending}
							onSettle={handleSettleTrip}
							onViewTrip={setDetailTripItem}
						/>
					)}

					{activeMainTab === "payouts" && (
						<AdminPayoutsTable
							items={payoutsData?.items || []}
							isLoading={isPayoutsLoading}
							onOpenConfirmModal={setConfirmPayoutModalItem}
							onOpenRejectModal={setRejectPayoutModalItem}
							onOpenDetailModal={setDetailPayoutItem}
						/>
					)}

					{activeMainTab === "refunds" && (
						<AdminRefundsTable
							refunds={refundsData?.items || []}
							isLoading={isRefundsLoading}
							onOpenConfirm={(item) => setSelectedRefundForConfirm(item)}
							onOpenReject={(item) => setSelectedRefundForReject(item)}
							onOpenDetail={(item) => setSelectedRefundForDetail(item)}
						/>
					)}

					{/* Integrated Pagination Bar */}
					<div className="flex flex-col gap-3 border-t border-[#e0ebe0] px-4 py-3 text-sm text-[#54655a] sm:flex-row sm:items-center sm:justify-between bg-white">
						<p>
							Tổng cộng <strong className="text-[#10221b]">{currentTotal}</strong>{" "}
							{activeMainTab === "settlements"
								? "chuyến đi"
								: activeMainTab === "payouts"
									? "yêu cầu rút tiền"
									: "yêu cầu hoàn tiền"}
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

			{/* Payout Detail Modal */}
			<AdminPayoutDetailModal
				payout={detailPayoutItem}
				isOpen={Boolean(detailPayoutItem)}
				onClose={() => setDetailPayoutItem(null)}
				onOpenConfirm={(payout) => {
					setDetailPayoutItem(null);
					setConfirmPayoutModalItem(payout);
				}}
				onOpenReject={(payout) => {
					setDetailPayoutItem(null);
					setRejectPayoutModalItem(payout);
				}}
			/>

			{/* Camper Refund Modals */}
			<RefundDetailsModal
				refund={selectedRefundForDetail}
				open={Boolean(selectedRefundForDetail)}
				onClose={() => setSelectedRefundForDetail(null)}
				onOpenConfirm={(item) => {
					setSelectedRefundForDetail(null);
					setSelectedRefundForConfirm(item);
				}}
				onOpenReject={(item) => {
					setSelectedRefundForDetail(null);
					setSelectedRefundForReject(item);
				}}
			/>

			<ConfirmTransferModal
				refund={selectedRefundForConfirm}
				open={Boolean(selectedRefundForConfirm)}
				isSubmitting={isConfirmingRefund}
				onClose={() => setSelectedRefundForConfirm(null)}
				onConfirm={handleConfirmRefund}
			/>

			<RejectRefundModal
				refund={selectedRefundForReject}
				open={Boolean(selectedRefundForReject)}
				isSubmitting={isRejectingRefund}
				onClose={() => setSelectedRefundForReject(null)}
				onReject={handleRejectRefund}
			/>
		</AdminLayout>
	);
}
