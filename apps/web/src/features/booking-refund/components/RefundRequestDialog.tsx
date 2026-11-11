import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, ExternalLink, Landmark, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useBankAccounts, validateAccountHolderNameMatch } from "../../bank-accounts";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { useCurrentUserProfile } from "../../camper-profile/hooks/useCurrentUserProfile";
import { type RefundRequestFormData, refundRequestSchema } from "../schema/booking-refund.schema";
import type { RefundError, RefundOrigin } from "../types";

export interface RefundRequestDialogProps {
	open: boolean;
	isSubmitting: boolean;
	error: RefundError | null;
	maxRefundableAmount?: string;
	defaultOrigin?: RefundOrigin;
	onSubmit: (input: RefundRequestFormData) => Promise<void>;
	onClose: () => void;
	onClearError: () => void;
}

export function RefundRequestDialog({
	open,
	isSubmitting,
	error,
	maxRefundableAmount,
	defaultOrigin,
	onSubmit,
	onClose,
	onClearError,
}: RefundRequestDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);

	const { data: bankAccounts, isLoading: isLoadingAccounts } = useBankAccounts();
	const { data: userProfile } = useCurrentUserProfile();
	const userFullName = userProfile?.fullName || "";

	const defaultAccount = bankAccounts?.find((a) => a.isDefault) ?? bankAccounts?.[0] ?? null;

	const {
		register,
		handleSubmit,
		setValue,
		formState: { errors },
		reset,
		setFocus,
	} = useForm<RefundRequestFormData>({
		resolver: zodResolver(refundRequestSchema),
		defaultValues: {
			reason: "",
			amount: maxRefundableAmount ? String(Math.floor(Number(maxRefundableAmount))) : "",
			bankName: "",
			accountNumber: "",
			accountHolderName: "",
			origin: defaultOrigin ?? "camper_complaint",
		},
	});

	const isNameMatching =
		userFullName && defaultAccount?.accountHolderName
			? validateAccountHolderNameMatch(defaultAccount.accountHolderName, userFullName)
			: true;

	useEffect(() => {
		const el = dialogRef.current;
		if (open) {
			const initialAmount = maxRefundableAmount
				? String(Math.floor(Number(maxRefundableAmount)))
				: "";

			if (defaultAccount) {
				reset({
					reason: "",
					amount: initialAmount,
					bankName: defaultAccount.bankName,
					accountNumber: defaultAccount.accountNumber,
					accountHolderName: defaultAccount.accountHolderName,
					origin: defaultOrigin ?? "camper_complaint",
				});
			} else {
				reset({
					reason: "",
					amount: initialAmount,
					bankName: "",
					accountNumber: "",
					accountHolderName: "",
					origin: defaultOrigin ?? "camper_complaint",
				});
			}

			el?.showModal();
			setFocus("reason");
		} else {
			el?.close();
			onClearError();
		}
		return () => el?.close();
	}, [open, maxRefundableAmount, defaultOrigin, defaultAccount, reset, setFocus, onClearError]);

	useEffect(() => {
		if (open && defaultAccount) {
			setValue("bankName", defaultAccount.bankName);
			setValue("accountNumber", defaultAccount.accountNumber);
			setValue("accountHolderName", defaultAccount.accountHolderName);
		}
	}, [open, defaultAccount, setValue]);

	const handleFormSubmit = async (data: RefundRequestFormData) => {
		const fullAmount = maxRefundableAmount
			? String(Math.floor(Number(maxRefundableAmount)))
			: data.amount;
		await onSubmit({
			...data,
			bankName: defaultAccount?.bankName ?? data.bankName,
			accountNumber: defaultAccount?.accountNumber ?? data.accountNumber,
			accountHolderName: (defaultAccount?.accountHolderName ?? data.accountHolderName ?? "")
				.trim()
				.toUpperCase(),
			amount: fullAmount,
		});
	};

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="refund-request-dialog-title"
			onCancel={(e) => {
				e.preventDefault();
				if (!isSubmitting) onClose();
			}}
			className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-[#cbd9ce] bg-white p-6 text-[#10221b] shadow-xl backdrop:bg-black/50"
		>
			<div className="flex items-center justify-between gap-3 border-b border-[#e7eee7] pb-3">
				<h2 id="refund-request-dialog-title" className="text-xl font-extrabold text-[#10221b]">
					Yêu cầu hoàn tiền & Khiếu nại
				</h2>
				<button
					type="button"
					aria-label="Đóng"
					disabled={isSubmitting}
					onClick={onClose}
					className="rounded-full p-1.5 text-[#667a6d] hover:bg-[#f4f7f2] hover:text-[#10221b] transition disabled:opacity-50"
				>
					<X className="size-5" />
				</button>
			</div>

			{error && (
				<div
					role="alert"
					className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
				>
					<p className="font-semibold">{error.message}</p>
				</div>
			)}

			<form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
				{/* Hidden form inputs registered with react-hook-form */}
				<input type="hidden" {...register("bankName")} />
				<input type="hidden" {...register("accountNumber")} />
				<input type="hidden" {...register("accountHolderName")} />
				<input type="hidden" {...register("amount")} />
				<input type="hidden" {...register("origin")} />

				<div>
					<label htmlFor="refund-reason" className="block text-sm font-bold text-[#10221b]">
						Lý do yêu cầu <span className="text-rose-600">*</span>
					</label>
					<textarea
						id="refund-reason"
						{...register("reason")}
						rows={4}
						disabled={isSubmitting}
						placeholder="Mô tả chi tiết lý do yêu cầu hoàn tiền hoặc sự cố chuyến đi..."
						className="mt-1.5 w-full rounded-xl border border-[#cbd9ce] p-3 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
					{errors.reason && <p className="mt-1 text-xs text-rose-600">{errors.reason.message}</p>}
				</div>

				<div className="space-y-3 rounded-2xl border border-[#cbd9ce] bg-[#f4f7f2] p-4">
					<div className="flex items-center justify-between">
						<p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#164027]">
							<Landmark className="size-4" />
							<span>Tài khoản nhận tiền hoàn</span>
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
												Tên chủ tài khoản khớp với họ tên hồ sơ người dùng ({userFullName}).
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
								Hệ thống chỉ hoàn tiền về tài khoản mặc định. Để thay đổi tài khoản, vui lòng thiết
								lập tại{" "}
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
										Hệ thống yêu cầu có tài khoản ngân hàng thụ hưởng mặc định để nhận tiền hoàn.
										Vui lòng thêm và đặt mặc định tài khoản trong Hồ sơ cá nhân trước khi gửi yêu
										cầu.
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

				<div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-bold uppercase tracking-wider text-[#164027]">
							Số tiền hoàn toàn bộ (100%)
						</span>
						<span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-[#164027]">
							Rút hết
						</span>
					</div>
					<p className="mt-1.5 text-2xl font-black text-[#164027]">
						{formatBookingMoney(maxRefundableAmount ?? null)}
					</p>
					<p className="mt-1 text-xs text-[#52665b]">
						Hệ thống tự động thực hiện hoàn toàn bộ 100% số tiền của chuyến đi theo chính sách.
					</p>
				</div>

				<div className="mt-6 flex flex-col gap-2 pt-2">
					<div className="flex justify-end gap-3">
						<button
							type="button"
							disabled={isSubmitting}
							onClick={onClose}
							className="rounded-xl border border-[#cbd9ce] px-4 py-2 text-sm font-semibold text-[#10221b] hover:bg-gray-50 disabled:opacity-50"
						>
							Hủy bỏ
						</button>
						<button
							type="submit"
							disabled={isSubmitting || isLoadingAccounts || !defaultAccount}
							data-testid="submit-refund-button"
							className="rounded-xl bg-[#164027] px-5 py-2 text-sm font-bold text-white hover:bg-[#123320] disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
						</button>
					</div>
					{!defaultAccount && !isLoadingAccounts && (
						<p className="text-right text-[11px] text-amber-700">
							* Cần có tài khoản ngân hàng mặc định trong Hồ sơ cá nhân để gửi yêu cầu hoàn tiền.
						</p>
					)}
				</div>
			</form>
		</dialog>
	);
}
