import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, ExternalLink, Landmark, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useBankAccounts, validateAccountHolderNameMatch } from "../../bank-accounts";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { useCurrentUserProfile } from "../../camper-profile/hooks/useCurrentUserProfile";
import { type HostPayoutFormData, hostPayoutSchema } from "../schema/payout.schema";
import type { RequestPayoutPayload } from "../types";

export interface HostPayoutModalProps {
	open: boolean;
	balance: string;
	isSubmitting: boolean;
	errorMessage?: string | null;
	onClose: () => void;
	onSubmit: (payload: RequestPayoutPayload) => Promise<void>;
	onClearError?: () => void;
}

export function HostPayoutModal({
	open,
	balance,
	isSubmitting,
	errorMessage,
	onClose,
	onSubmit,
	onClearError,
}: HostPayoutModalProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	const { data: bankAccounts, isLoading: isLoadingAccounts } = useBankAccounts();
	const { data: userProfile } = useCurrentUserProfile();
	const userFullName = userProfile?.fullName || "";

	const defaultAccount = bankAccounts?.find((a) => a.isDefault) ?? bankAccounts?.[0] ?? null;

	const {
		register,
		handleSubmit,
		setValue,
		reset,
		formState: { errors },
	} = useForm<HostPayoutFormData>({
		resolver: zodResolver(hostPayoutSchema),
		defaultValues: {
			bankName: "",
			accountNumber: "",
			accountHolderName: "",
			notes: "",
		},
	});

	const isNameMatching =
		userFullName && defaultAccount?.accountHolderName
			? validateAccountHolderNameMatch(defaultAccount.accountHolderName, userFullName)
			: true;

	// When modal opens, populate with default bank account
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (open) {
			if (!dialog.open) {
				dialog.showModal();
			}
			onClearError?.();

			if (defaultAccount) {
				reset({
					bankName: defaultAccount.bankName,
					accountNumber: defaultAccount.accountNumber,
					accountHolderName: defaultAccount.accountHolderName,
					notes: "",
				});
			} else {
				reset({
					bankName: "",
					accountNumber: "",
					accountHolderName: "",
					notes: "",
				});
			}
		} else if (dialog.open) {
			dialog.close();
		}
	}, [open, defaultAccount, reset, onClearError]);

	// Keep values in sync when defaultAccount finishes loading while modal is already open
	useEffect(() => {
		if (open && defaultAccount) {
			setValue("bankName", defaultAccount.bankName);
			setValue("accountNumber", defaultAccount.accountNumber);
			setValue("accountHolderName", defaultAccount.accountHolderName);
		}
	}, [open, defaultAccount, setValue]);

	const onFormSubmit = async (data: HostPayoutFormData) => {
		await onSubmit({
			bankName: defaultAccount?.bankName ?? data.bankName,
			accountNumber: defaultAccount?.accountNumber ?? data.accountNumber,
			accountHolderName: (defaultAccount?.accountHolderName ?? data.accountHolderName ?? "")
				.trim()
				.toUpperCase(),
			notes: data.notes?.trim() || undefined,
		});
	};

	if (!open) return null;

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="payout-modal-title"
			className="fixed inset-0 m-auto w-full max-w-lg rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
			onCancel={(e) => {
				e.preventDefault();
				if (!isSubmitting) onClose();
			}}
		>
			<div className="flex items-center justify-between border-b border-[#e7eee7] pb-4">
				<h2 id="payout-modal-title" className="text-lg font-black text-[#10221b]">
					Yêu cầu rút tiền về ngân hàng
				</h2>
				<button
					type="button"
					aria-label="Đóng"
					disabled={isSubmitting}
					onClick={onClose}
					className="rounded-xl p-1.5 text-[#52665b] transition hover:bg-[#edf3ed] hover:text-[#10221b] disabled:opacity-50"
				>
					<X className="size-5" />
				</button>
			</div>

			<form onSubmit={handleSubmit(onFormSubmit)} className="mt-5 space-y-4">
				{/* Hidden form fields tracked by react-hook-form */}
				<input type="hidden" {...register("bankName")} />
				<input type="hidden" {...register("accountNumber")} />
				<input type="hidden" {...register("accountHolderName")} />

				{errorMessage && (
					<div
						role="alert"
						className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
					>
						{errorMessage}
					</div>
				)}

				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold uppercase tracking-wider text-[#164027]">
							Số tiền rút toàn bộ số dư
						</span>
						<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-[#164027]">
							Rút hết 100%
						</span>
					</div>
					<p className="mt-1.5 text-2xl font-black text-[#164027]">{formatBookingMoney(balance)}</p>
					<p className="mt-1 text-xs text-[#52665b]">
						Toàn bộ số dư ví khả dụng sẽ được chuyển về tài khoản ngân hàng thụ hưởng sau khi Quản
						trị viên duyệt.
					</p>
				</div>

				{/* Read-only Default Bank Account Card */}
				<div className="space-y-3 rounded-2xl border border-[#dfe8df] bg-[#f9fbf9] p-4">
					<div className="flex items-center justify-between">
						<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#164027]">
							<Landmark className="size-4" />
							<span>Tài khoản nhận tiền rút</span>
						</p>
						{defaultAccount && (
							<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-[#164027]">
								Mặc định
							</span>
						)}
					</div>

					{isLoadingAccounts ? (
						<div className="py-3 text-center text-xs text-[#52665b]">
							Đang tải thông tin tài khoản ngân hàng...
						</div>
					) : defaultAccount ? (
						<div className="space-y-3">
							<div className="rounded-xl border border-[#cbd9ce] bg-white p-3.5 shadow-xs space-y-2">
								<div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-2">
									<span className="text-xs text-[#667a6d]">Ngân hàng thụ hưởng:</span>
									<span className="text-sm font-bold text-[#10221b]">
										{defaultAccount.bankName}
									</span>
								</div>
								<div className="flex items-baseline justify-between gap-2 border-b border-gray-100 pb-2">
									<span className="text-xs text-[#667a6d]">Số tài khoản:</span>
									<span className="font-mono text-sm font-bold tracking-wider text-[#10221b]">
										{defaultAccount.accountNumber}
									</span>
								</div>
								<div className="flex items-baseline justify-between gap-2">
									<span className="text-xs text-[#667a6d]">Tên chủ tài khoản:</span>
									<span className="text-xs font-bold uppercase text-[#10221b]">
										{defaultAccount.accountHolderName}
									</span>
								</div>
							</div>

							{userFullName && (
								<div className="pt-0.5">
									{isNameMatching ? (
										<p className="flex items-center gap-1 text-[11px] text-emerald-700">
											<Check className="size-3.5 shrink-0" />
											<span>
												Tên chủ tài khoản hợp lệ (trùng khớp họ tên hồ sơ {userFullName}).
											</span>
										</p>
									) : (
										<p className="flex items-center gap-1 text-[11px] text-amber-700">
											<AlertCircle className="size-3.5 shrink-0" />
											<span>
												Lưu ý: Tên chủ tài khoản ({defaultAccount.accountHolderName}) không khớp
												hoàn toàn với họ tên hồ sơ ({userFullName}).
											</span>
										</p>
									)}
								</div>
							)}

							<p className="text-[11px] text-[#52665b]">
								Hệ thống chỉ chuyển tiền về tài khoản mặc định. Để thay đổi tài khoản, vui lòng
								thiết lập tại{" "}
								<a
									href="/profile?tab=bank_accounts"
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-0.5 font-bold text-[#164027] hover:underline"
								>
									<span>Hồ sơ cá nhân</span>
									<ExternalLink className="size-3" />
								</a>
								.
							</p>
						</div>
					) : (
						<div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-2">
							<div className="flex items-start gap-2">
								<AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
								<div>
									<p className="font-bold">Bạn chưa có tài khoản ngân hàng nào</p>
									<p className="mt-1 text-[11px] text-amber-800">
										Hệ thống yêu cầu có tài khoản ngân hàng thụ hưởng mặc định để rút tiền. Vui lòng
										thêm và đặt mặc định tài khoản trong Hồ sơ cá nhân trước khi gửi yêu cầu.
									</p>
								</div>
							</div>
							<div className="pt-1">
								<a
									href="/profile?tab=bank_accounts"
									target="_blank"
									rel="noreferrer"
									className="inline-flex items-center gap-1.5 rounded-xl bg-[#164027] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#123320] transition"
								>
									<span>Đi đến Hồ sơ cá nhân để thêm tài khoản</span>
									<ExternalLink className="size-3.5" />
								</a>
							</div>
						</div>
					)}
				</div>

				<div>
					<label htmlFor="payout-notes" className="block text-xs font-bold text-[#10221b]">
						Ghi chú rút tiền (Tùy chọn)
					</label>
					<input
						id="payout-notes"
						type="text"
						{...register("notes")}
						disabled={isSubmitting}
						placeholder="Ghi chú thêm cho Quản trị viên đối soát..."
						className="mt-1.5 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
					{errors.notes && <p className="mt-1 text-xs text-rose-600">{errors.notes.message}</p>}
				</div>

				<div className="mt-6 flex flex-col gap-2 pt-3">
					<div className="flex items-center justify-end gap-3">
						<button
							type="button"
							disabled={isSubmitting}
							onClick={onClose}
							className="rounded-xl border border-[#cbd9ce] px-4 py-2.5 text-xs font-bold text-[#425048] hover:bg-[#f1f5f0] disabled:opacity-50"
						>
							Hủy bỏ
						</button>
						<button
							type="submit"
							data-testid="submit-payout-button"
							disabled={
								isSubmitting || Number(balance) <= 0 || !defaultAccount || isLoadingAccounts
							}
							className="rounded-xl bg-[#164027] px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#11321f] disabled:cursor-not-allowed disabled:bg-gray-300"
						>
							{isSubmitting ? "Đang gửi yêu cầu..." : `Xác nhận rút ${formatBookingMoney(balance)}`}
						</button>
					</div>
					{!defaultAccount && !isLoadingAccounts && (
						<p className="text-right text-[11px] text-amber-700">
							* Cần có tài khoản ngân hàng mặc định trong Hồ sơ cá nhân để gửi yêu cầu rút tiền.
						</p>
					)}
				</div>
			</form>
		</dialog>
	);
}
