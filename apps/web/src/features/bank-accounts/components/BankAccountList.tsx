import { Building2, Check, CreditCard, Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import {
	useBankAccounts,
	useDeleteBankAccount,
	useSetDefaultBankAccount,
} from "../hooks/useBankAccounts";
import type { BankAccountItem } from "../types";
import { AddBankAccountDialog } from "./AddBankAccountDialog";

export interface BankAccountListProps {
	userFullName?: string;
	title?: string;
	description?: string;
	className?: string;
}

export function BankAccountList({
	userFullName,
	title = "Tài khoản ngân hàng thụ hưởng",
	description = "Quản lý danh sách tài khoản nhận tiền rút về hoặc nhận tiền hoàn (Camper & Host).",
	className = "",
}: BankAccountListProps) {
	const [addModalOpen, setAddModalOpen] = useState(false);
	const [accountToDelete, setAccountToDelete] = useState<BankAccountItem | null>(null);

	const { data: accounts, isLoading, error, refetch } = useBankAccounts();
	const deleteMutation = useDeleteBankAccount();
	const setDefaultMutation = useSetDefaultBankAccount();

	const handleConfirmDelete = async () => {
		if (!accountToDelete) return;
		try {
			await deleteMutation.mutateAsync(accountToDelete.id);
			setAccountToDelete(null);
		} catch {
			// Mutation error handled by TanStack Query
		}
	};

	const handleSetDefault = async (id: string) => {
		await setDefaultMutation.mutateAsync(id);
	};

	return (
		<div className={`rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm ${className}`}>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#e7eee7] pb-4">
				<div>
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-xl bg-[#164027]/10 text-[#164027]">
							<CreditCard className="size-4" />
						</div>
						<h2 className="text-base font-extrabold text-[#10221b]">{title}</h2>
					</div>
					<p className="mt-1 text-xs text-[#667a6d]">{description}</p>
				</div>

				<button
					type="button"
					onClick={() => setAddModalOpen(true)}
					className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#11321f]"
				>
					<Plus className="size-4" />
					<span>Thêm tài khoản</span>
				</button>
			</div>

			<div className="mt-4">
				{isLoading && (
					<div className="flex items-center justify-center gap-2 py-8 text-xs text-[#164027]">
						<Loader2 className="size-4 animate-spin" />
						<span>Đang tải danh sách tài khoản...</span>
					</div>
				)}

				{!isLoading && error && (
					<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-xs text-rose-800">
						<p className="font-bold">Không thể tải danh sách tài khoản ngân hàng.</p>
						<button
							type="button"
							onClick={() => void refetch()}
							className="mt-2 rounded-lg bg-rose-700 px-3 py-1 font-bold text-white hover:bg-rose-800"
						>
							Thử lại
						</button>
					</div>
				)}

				{!isLoading && !error && (!accounts || accounts.length === 0) && (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cbd9ce] py-10 text-center">
						<Building2 className="size-10 text-[#a0b2a5]" />
						<p className="mt-2 text-xs font-bold text-[#10221b]">
							Chưa có tài khoản ngân hàng nào được liên kết
						</p>
						<p className="mt-1 text-[11px] text-[#667a6d] max-w-sm">
							Thêm tài khoản ngân hàng để hệ thống tự động điền khi bạn yêu cầu rút tiền hoặc nhận
							tiền hoàn.
						</p>
						<button
							type="button"
							onClick={() => setAddModalOpen(true)}
							className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#edf3ed] px-3.5 py-1.5 text-xs font-bold text-[#164027] hover:bg-[#dfeade]"
						>
							<Plus className="size-3.5" />
							<span>Thêm tài khoản ngay</span>
						</button>
					</div>
				)}

				{!isLoading && !error && accounts && accounts.length > 0 && (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{accounts.map((acc) => {
							const isDeleting = deleteMutation.isPending && deleteMutation.variables === acc.id;
							const isSettingDefault =
								setDefaultMutation.isPending && setDefaultMutation.variables === acc.id;

							return (
								<div
									key={acc.id}
									className={`relative flex flex-col justify-between rounded-2xl border p-4 transition ${
										acc.isDefault
											? "border-[#164027]/40 bg-[#f7faf7] shadow-xs ring-1 ring-[#164027]/15"
											: "border-[#e2eae1] bg-white hover:border-[#cbd9ce]"
									}`}
								>
									<div>
										<div className="flex items-center justify-between gap-2">
											<span className="text-xs font-black text-[#164027] truncate">
												{acc.bankName}
											</span>
											{acc.isDefault && (
												<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-[#164027]">
													<Star className="size-3 fill-emerald-600 text-emerald-600" />
													Mặc định
												</span>
											)}
										</div>

										<p className="mt-2 font-mono text-base font-black tracking-wide text-[#10221b]">
											{acc.accountNumber}
										</p>
										<p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-[#52665b]">
											{acc.accountHolderName}
										</p>
									</div>

									<div className="mt-4 flex items-center justify-between border-t border-[#edf3ed] pt-3">
										{!acc.isDefault ? (
											<button
												type="button"
												disabled={isSettingDefault || isDeleting}
												onClick={() => handleSetDefault(acc.id)}
												className="inline-flex items-center gap-1 text-[11px] font-bold text-[#164027] hover:underline disabled:opacity-50"
											>
												{isSettingDefault ? (
													<Loader2 className="size-3 animate-spin" />
												) : (
													<Check className="size-3" />
												)}
												<span>Đặt làm mặc định</span>
											</button>
										) : (
											<span className="text-[11px] font-semibold text-[#667a6d]">
												Tài khoản ưu tiên
											</span>
										)}

										<button
											type="button"
											aria-label="Xóa tài khoản"
											disabled={isDeleting}
											onClick={() => setAccountToDelete(acc)}
											className="rounded-lg p-1 text-[#7d8d83] transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
										>
											{isDeleting ? (
												<Loader2 className="size-3.5 animate-spin" />
											) : (
												<Trash2 className="size-3.5" />
											)}
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			<AddBankAccountDialog
				open={addModalOpen}
				onClose={() => setAddModalOpen(false)}
				userFullName={userFullName}
			/>

			<ConfirmModal
				isOpen={Boolean(accountToDelete)}
				onClose={() => setAccountToDelete(null)}
				onConfirm={handleConfirmDelete}
				title="Xóa tài khoản ngân hàng"
				description={
					<span>
						Bạn có chắc chắn muốn xóa tài khoản <strong>{accountToDelete?.bankName}</strong> (
						<span className="font-mono">{accountToDelete?.accountNumber}</span>) khỏi danh sách
						không?
					</span>
				}
				confirmText="Xóa tài khoản"
				cancelText="Hủy bỏ"
				variant="danger"
				isLoading={deleteMutation.isPending}
			/>
		</div>
	);
}
