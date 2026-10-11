import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { formatBookingMoney } from "../../booking-details/utils/booking-details-formatters";
import { VIETNAM_POPULAR_BANKS } from "../constants";
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
	const maxLimit = maxRefundableAmount ? Number(maxRefundableAmount) : null;

	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
		setFocus,
		setValue,
		setError,
	} = useForm<RefundRequestFormData>({
		resolver: zodResolver(refundRequestSchema),
		defaultValues: {
			reason: "",
			amount: maxRefundableAmount ? String(Math.floor(Number(maxRefundableAmount))) : "",
			bankName: "Vietcombank",
			accountNumber: "",
			accountHolderName: "",
			origin: defaultOrigin ?? "camper_complaint",
		},
	});

	useEffect(() => {
		const el = dialogRef.current;
		if (open) {
			reset({
				reason: "",
				amount: maxRefundableAmount ? String(Math.floor(Number(maxRefundableAmount))) : "",
				bankName: "Vietcombank",
				accountNumber: "",
				accountHolderName: "",
				origin: defaultOrigin ?? "camper_complaint",
			});
			el?.showModal();
			setFocus("reason");
		} else {
			el?.close();
			onClearError();
		}
		return () => el?.close();
	}, [open, maxRefundableAmount, defaultOrigin, reset, setFocus, onClearError]);

	const handleFormSubmit = async (data: RefundRequestFormData) => {
		if (maxLimit !== null && data.amount?.trim()) {
			const num = Number(data.amount);
			if (Number.isFinite(num) && num > maxLimit) {
				setError("amount", {
					type: "manual",
					message: `Số tiền yêu cầu hoàn không được vượt quá số tiền của chuyến đi: ${formatBookingMoney(maxRefundableAmount ?? null)}`,
				});
				return;
			}
			if (Number.isFinite(num) && num <= 0) {
				setError("amount", {
					type: "manual",
					message: "Số tiền yêu cầu hoàn phải lớn hơn 0 VNĐ",
				});
				return;
			}
		}
		await onSubmit(data);
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
			<h2 id="refund-request-dialog-title" className="text-xl font-extrabold text-[#10221b]">
				Yêu cầu hoàn tiền & Khiếu nại
			</h2>

			{error && (
				<div
					role="alert"
					className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
				>
					<p className="font-semibold">{error.message}</p>
				</div>
			)}

			<form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
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
					<p className="text-xs font-bold uppercase tracking-wider text-[#164027]">
						Thông tin tài khoản nhận tiền hoàn (Admin chuyển khoản thủ công)
					</p>

					<div>
						<label htmlFor="refund-bank-name" className="block text-xs font-bold text-[#10221b]">
							Ngân hàng thụ hưởng <span className="text-rose-600">*</span>
						</label>
						<select
							id="refund-bank-name"
							{...register("bankName")}
							disabled={isSubmitting}
							className="mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white p-2 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
						>
							{VIETNAM_POPULAR_BANKS.map((b) => (
								<option key={b} value={b}>
									{b}
								</option>
							))}
						</select>
						{errors.bankName && (
							<p className="mt-1 text-xs text-rose-600">{errors.bankName.message}</p>
						)}
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label
								htmlFor="refund-account-number"
								className="block text-xs font-bold text-[#10221b]"
							>
								Số tài khoản <span className="text-rose-600">*</span>
							</label>
							<input
								id="refund-account-number"
								type="text"
								{...register("accountNumber")}
								disabled={isSubmitting}
								placeholder="Ví dụ: 1029384756"
								className="mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white p-2 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
							/>
							{errors.accountNumber && (
								<p className="mt-1 text-xs text-rose-600">{errors.accountNumber.message}</p>
							)}
						</div>

						<div>
							<label
								htmlFor="refund-account-holder"
								className="block text-xs font-bold text-[#10221b]"
							>
								Tên chủ tài khoản <span className="text-rose-600">*</span>
							</label>
							<input
								id="refund-account-holder"
								type="text"
								{...register("accountHolderName")}
								disabled={isSubmitting}
								placeholder="NGUYEN VAN A"
								className="mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white p-2 text-sm uppercase focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
							/>
							{errors.accountHolderName && (
								<p className="mt-1 text-xs text-rose-600">{errors.accountHolderName.message}</p>
							)}
						</div>
					</div>
				</div>

				<div>
					<div className="flex items-center justify-between">
						<label htmlFor="refund-amount" className="block text-sm font-bold text-[#10221b]">
							Số tiền yêu cầu hoàn (VNĐ)
						</label>
						{maxRefundableAmount && (
							<span className="text-xs text-[#52665b]">
								Tối đa:{" "}
								<strong className="text-[#164027]">
									{formatBookingMoney(maxRefundableAmount ?? null)}
								</strong>
							</span>
						)}
					</div>

					<div className="relative mt-1.5 flex items-center">
						<input
							id="refund-amount"
							type="text"
							inputMode="numeric"
							{...register("amount", {
								onChange: (e) => {
									const val = e.target.value;
									if (maxLimit !== null && val) {
										const num = Number(val);
										if (Number.isFinite(num) && num > maxLimit) {
											setValue("amount", String(Math.floor(maxLimit)), {
												shouldValidate: true,
											});
										}
									}
								},
							})}
							disabled={isSubmitting}
							placeholder={
								maxRefundableAmount
									? `Tối đa ${formatBookingMoney(maxRefundableAmount ?? null)}`
									: "Nhập số tiền hoàn"
							}
							className="w-full rounded-xl border border-[#cbd9ce] p-2.5 pr-20 text-sm focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
						/>
						{maxRefundableAmount && (
							<button
								type="button"
								onClick={() => {
									setValue("amount", String(Math.floor(Number(maxRefundableAmount))), {
										shouldValidate: true,
									});
								}}
								className="absolute right-2 rounded-lg bg-[#edf3ed] px-2.5 py-1 text-xs font-bold text-[#164027] hover:bg-[#dfeade]"
							>
								Tối đa
							</button>
						)}
					</div>
					{errors.amount && <p className="mt-1 text-xs text-rose-600">{errors.amount.message}</p>}
					<p className="mt-1 text-[11px] text-[#667a6d]">
						Số tiền hoàn tối đa là số tiền của chuyến đi (
						{formatBookingMoney(maxRefundableAmount ?? null)}). Không thể nhập vượt quá mức này.
					</p>
				</div>

				<div className="mt-6 flex justify-end gap-3 pt-2">
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
						disabled={isSubmitting}
						data-testid="submit-refund-button"
						className="rounded-xl bg-[#164027] px-5 py-2 text-sm font-bold text-white hover:bg-[#123320] disabled:opacity-50"
					>
						{isSubmitting ? "Đang gửi yêu cầu..." : "Gửi yêu cầu hoàn tiền"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
