import {
	ArrowDownRight,
	ArrowUpRight,
	Clock,
	Coins,
	History,
	Loader2,
	RefreshCw,
	Wallet,
} from "lucide-react";
import { useState } from "react";
import { BankAccountList } from "../../bank-accounts";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { useCurrentUserProfile } from "../../camper-profile/hooks/useCurrentUserProfile";
import { HostPayoutModal } from "../components/HostPayoutModal";
import { TRANSACTION_TYPE_LABELS } from "../constants";
import { useHostWallet, useRequestHostPayout } from "../hooks/useSettlements";
import type { RequestPayoutPayload } from "../types";

export interface HostWalletPageProps {
	onBackHome?: () => void;
}

export function HostWalletPage({ onBackHome }: HostWalletPageProps) {
	const [payoutModalOpen, setPayoutModalOpen] = useState(false);
	const [payoutError, setPayoutError] = useState<string | null>(null);

	const { data: wallet, isLoading, error, refetch, isFetching } = useHostWallet();
	const { data: userProfile } = useCurrentUserProfile();
	const requestPayoutMutation = useRequestHostPayout();

	const handleRequestPayout = async (payload: RequestPayoutPayload) => {
		try {
			setPayoutError(null);
			await requestPayoutMutation.mutateAsync(payload);
			setPayoutModalOpen(false);
		} catch (err) {
			setPayoutError(
				err instanceof Error
					? err.message
					: "Không thể gửi yêu cầu rút tiền. Vui lòng kiểm tra lại."
			);
		}
	};

	const balanceNum = wallet ? Number(wallet.balance) : 0;
	const hasPendingPayout = Boolean(wallet?.pendingPayout);
	const canWithdraw = balanceNum > 0 && !hasPendingPayout;

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans text-[#10221b] antialiased">
			{/* Header */}
			<header className="border-b border-[#dfe8df] bg-white sticky top-0 z-20 backdrop-blur-sm bg-white/95">
				<div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-2xl bg-[#164027]/10 text-[#164027]">
							<Wallet className="size-5" />
						</div>
						<div>
							<h1 className="text-lg font-black text-[#10221b] sm:text-xl">
								Ví Host & Quản lý Doanh thu
							</h1>
							<p className="text-xs font-semibold text-[#667a6d]">
								Theo dõi số dư quyết toán, phí nền tảng 5% và yêu cầu rút tiền
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => void refetch()}
							disabled={isFetching}
							className="rounded-xl border border-[#dfe8df] p-2.5 text-[#55685a] transition hover:bg-[#f6f9f6] hover:text-[#164027] disabled:opacity-50"
							aria-label="Tải lại số dư"
						>
							<RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
						</button>
						{onBackHome && (
							<button
								type="button"
								onClick={onBackHome}
								className="rounded-xl bg-[#edf3ed] px-4 py-2 text-xs font-bold text-[#164027] hover:bg-[#dfeade]"
							>
								Trang chủ
							</button>
						)}
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
				{isLoading && (
					<div className="flex flex-col items-center justify-center gap-3 rounded-3xl bg-white p-16 shadow-sm">
						<Loader2 className="size-6 animate-spin text-[#164027]" />
						<p className="text-sm font-bold text-[#164027]">Đang tải dữ liệu ví...</p>
					</div>
				)}

				{!isLoading && error && (
					<div
						role="alert"
						className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800 shadow-sm"
					>
						<p className="font-bold">Không thể tải thông tin ví</p>
						<button
							type="button"
							onClick={() => void refetch()}
							className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800"
						>
							Thử lại
						</button>
					</div>
				)}

				{!isLoading && wallet && (
					<>
						{/* Wallet Balance Hero Card */}
						<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2 rounded-3xl border border-[#dfe8df] bg-gradient-to-br from-[#164027] to-[#0d2617] p-8 text-white shadow-md">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2 text-emerald-200 text-xs font-extrabold uppercase tracking-wider">
										<Coins className="size-4" />
										<span>Số dư khả dụng</span>
									</div>
									<span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-100 border border-emerald-400/30">
										CTMS Host Wallet
									</span>
								</div>

								<div className="mt-4">
									<p className="text-4xl font-black tracking-tight sm:text-5xl text-white">
										{formatBookingMoney(wallet.balance)}
									</p>
									<p className="mt-2 text-xs text-emerald-100/80">
										Số tiền thực nhận (95% doanh thu chuyến đi sau khi trừ 5% phí nền tảng CTMS)
									</p>
								</div>

								<div className="mt-8 flex flex-wrap items-center gap-4">
									<button
										type="button"
										onClick={() => setPayoutModalOpen(true)}
										disabled={!canWithdraw}
										data-testid="request-payout-button"
										className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-[#164027] shadow-lg transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
									>
										Rút toàn bộ số dư
									</button>

									{hasPendingPayout && (
										<span className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
											<Clock className="size-4" />
											Đang có 1 yêu cầu rút tiền chờ xử lý
										</span>
									)}

									{!hasPendingPayout && balanceNum <= 0 && (
										<span className="text-xs text-emerald-200/70">
											Số dư hiện tại là 0 VNĐ. Tiền sẽ được cộng sau khi chuyến đi quyết toán.
										</span>
									)}
								</div>
							</div>

							{/* Payout Pending Info / Summary */}
							<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm flex flex-col justify-between">
								<div>
									<h2 className="text-sm font-extrabold text-[#10221b]">Trạng thái giao dịch</h2>
									{wallet.pendingPayout ? (
										<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
											<div className="flex items-center gap-2 text-amber-900 text-xs font-extrabold">
												<Clock className="size-4 text-amber-700 shrink-0" />
												<span>Yêu cầu rút tiền đang chờ duyệt</span>
											</div>
											<p className="mt-2 text-xl font-black text-amber-950">
												{formatBookingMoney(wallet.pendingPayout.amount)}
											</p>
											<div className="mt-2 text-[11px] text-amber-800 space-y-0.5">
												<p>
													Ngân hàng: <strong>{wallet.pendingPayout.bankName}</strong>
												</p>
												<p>
													Số tài khoản: <strong>{wallet.pendingPayout.accountNumber}</strong>
												</p>
												<p>
													Chủ TK: <strong>{wallet.pendingPayout.accountHolderName}</strong>
												</p>
											</div>
											<p className="mt-2 text-[10px] text-amber-700 italic">
												Quản trị viên đang đối soát và chuyển khoản thủ công.
											</p>
										</div>
									) : (
										<div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
											<p className="text-xs font-bold text-[#164027]">Chính sách rút tiền</p>
											<ul className="mt-2 list-inside list-disc space-y-1 text-xs text-[#52665b]">
												<li>Rút toàn bộ số dư (100%), không giữ lại số dư tối thiểu.</li>
												<li>Không thu thêm phí rút tiền.</li>
												<li>Admin chuyển khoản trực tiếp qua tài khoản ngân hàng thụ hưởng.</li>
											</ul>
										</div>
									)}
								</div>

								<div className="mt-4 pt-4 border-t border-[#edf3ed] text-[11px] text-[#7d8d83]">
									Mọi thắc mắc về quyết toán vui lòng liên hệ đội ngũ hỗ trợ CTMS.
								</div>
							</div>
						</div>

						{/* Bank Accounts Management */}
						<BankAccountList
							userFullName={userProfile?.fullName}
							title="Tài khoản ngân hàng nhận tiền rút"
							description="Quản lý danh sách tài khoản ngân hàng thụ hưởng. Hệ thống sẽ tự động điền tài khoản mặc định khi bạn gửi yêu cầu rút tiền."
						/>

						{/* Ledger / Transaction History */}
						<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<div className="flex items-center justify-between border-b border-[#e7eee7] pb-4">
								<div className="flex items-center gap-2.5">
									<History className="size-5 text-[#164027]" />
									<h2 className="text-base font-extrabold text-[#10221b]">
										Lịch sử biến động số dư
									</h2>
								</div>
								<span className="text-xs font-semibold text-[#667a6d]">
									{wallet.transactions.length} giao dịch gần nhất
								</span>
							</div>

							{wallet.transactions.length === 0 ? (
								<div className="py-12 text-center text-xs text-[#667a6d]">
									Chưa có biến động số dư nào trong ví của bạn.
								</div>
							) : (
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
											{wallet.transactions.map((t) => {
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
							)}
						</div>
					</>
				)}
			</main>

			{/* Host Payout Modal */}
			{wallet && (
				<HostPayoutModal
					open={payoutModalOpen}
					balance={wallet.balance}
					isSubmitting={requestPayoutMutation.isPending}
					errorMessage={payoutError}
					onClose={() => setPayoutModalOpen(false)}
					onSubmit={handleRequestPayout}
					onClearError={() => setPayoutError(null)}
				/>
			)}
		</div>
	);
}
