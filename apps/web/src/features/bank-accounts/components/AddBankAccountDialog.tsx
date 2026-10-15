import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Building2, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { VIETNAM_POPULAR_BANKS } from "../constants";
import { useAddBankAccount } from "../hooks/useBankAccounts";
import {
	type CreateBankAccountFormData,
	createBankAccountSchema,
} from "../schema/bank-account.schema";
import type { BankAccountItem } from "../types";
import {
	normalizeVietnameseName,
	validateAccountHolderNameMatch,
} from "../utils/vietnamese-name.util";

export interface AddBankAccountDialogProps {
	open: boolean;
	onClose: () => void;
	userFullName?: string;
	onSuccess?: (createdAccount: BankAccountItem) => void;
}

export function AddBankAccountDialog({
	open,
	onClose,
	userFullName,
	onSuccess,
}: AddBankAccountDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [serverError, setServerError] = useState<string | null>(null);

	const addBankAccountMutation = useAddBankAccount();

	const defaultAccountHolderName = userFullName ? normalizeVietnameseName(userFullName) : "";

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<CreateBankAccountFormData>({
		resolver: zodResolver(createBankAccountSchema),
		defaultValues: {
			bankName: VIETNAM_POPULAR_BANKS[0],
			accountNumber: "",
			accountHolderName: defaultAccountHolderName,
			isDefault: true,
		},
	});

	const watchedHolderName = watch("accountHolderName");
	const isNameMatching = userFullName
		? validateAccountHolderNameMatch(watchedHolderName, userFullName)
		: true;

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;

		if (open) {
			if (!dialog.open) {
				dialog.showModal();
			}
			reset({
				bankName: VIETNAM_POPULAR_BANKS[0],
				accountNumber: "",
				accountHolderName: defaultAccountHolderName,
				isDefault: true,
			});
			setServerError(null);
		} else if (dialog.open) {
			dialog.close();
		}
	}, [open, reset, defaultAccountHolderName]);

	const onFormSubmit = async (data: CreateBankAccountFormData) => {
		setServerError(null);
		try {
			const res = await addBankAccountMutation.mutateAsync({
				bankName: data.bankName,
				accountNumber: data.accountNumber.replace(/\s+/g, ""),
				accountHolderName: data.accountHolderName.trim().toUpperCase(),
				isDefault: data.isDefault,
			});
			onSuccess?.(res);
			onClose();
		} catch (err) {
			const msg =
				err instanceof Error
					? err.message
					: "Không thể thêm tài khoản ngân hàng. Vui lòng thử lại.";
			setServerError(msg);
		}
	};

	if (!open) return null;

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby="add-bank-dialog-title"
			className="fixed inset-0 m-auto w-full max-w-lg rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
			onCancel={(e) => {
				e.preventDefault();
				if (!addBankAccountMutation.isPending) onClose();
			}}
		>
			<div className="flex items-center justify-between border-b border-[#e7eee7] pb-4">
				<div className="flex items-center gap-2.5">
					<div className="flex size-9 items-center justify-center rounded-xl bg-[#164027]/10 text-[#164027]">
						<Building2 className="size-5" />
					</div>
					<h2 id="add-bank-dialog-title" className="text-lg font-black text-[#10221b]">
						Thêm tài khoản ngân hàng
					</h2>
				</div>
				<button
					type="button"
					aria-label="Đóng"
					disabled={addBankAccountMutation.isPending}
					onClick={onClose}
					className="rounded-xl p-1.5 text-[#52665b] transition hover:bg-[#edf3ed] hover:text-[#10221b] disabled:opacity-50"
				>
					<X className="size-5" />
				</button>
			</div>

			<form onSubmit={handleSubmit(onFormSubmit)} className="mt-5 space-y-4">
				{serverError && (
					<div
						role="alert"
						className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
					>
						<AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
						<span>{serverError}</span>
					</div>
				)}

				<div>
					<label htmlFor="add-bank-name" className="block text-xs font-bold text-[#10221b]">
						Ngân hàng thụ hưởng *
					</label>
					<select
						id="add-bank-name"
						{...register("bankName")}
						disabled={addBankAccountMutation.isPending}
						className="mt-1.5 w-full rounded-xl border border-[#cbd9ce] bg-white p-2.5 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
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

				<div>
					<label htmlFor="add-account-number" className="block text-xs font-bold text-[#10221b]">
						Số tài khoản ngân hàng *
					</label>
					<input
						id="add-account-number"
						type="text"
						{...register("accountNumber")}
						disabled={addBankAccountMutation.isPending}
						placeholder="Ví dụ: 0123456789"
						className="mt-1.5 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm font-medium focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
					{errors.accountNumber && (
						<p className="mt-1 text-xs text-rose-600">{errors.accountNumber.message}</p>
					)}
				</div>

				<div>
					<div className="flex items-center justify-between">
						<label htmlFor="add-account-holder" className="block text-xs font-bold text-[#10221b]">
							Tên chủ tài khoản (In hoa không dấu) *
						</label>
						{userFullName && (
							<span className="text-[11px] text-[#52665b]">
								Hồ sơ: <strong className="text-[#164027]">{userFullName}</strong>
							</span>
						)}
					</div>
					<input
						id="add-account-holder"
						type="text"
						{...register("accountHolderName", {
							onChange: (e) => {
								setValue("accountHolderName", (e.target.value as string).toUpperCase());
							},
						})}
						disabled={addBankAccountMutation.isPending}
						placeholder="Ví dụ: NGUYEN VAN A"
						className="mt-1.5 w-full rounded-xl border border-[#cbd9ce] p-2.5 text-sm font-medium uppercase focus:border-[#164027] focus:outline-none disabled:bg-gray-100"
					/>
					{errors.accountHolderName && (
						<p className="mt-1 text-xs text-rose-600">{errors.accountHolderName.message}</p>
					)}

					{userFullName && watchedHolderName && !isNameMatching && (
						<p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
							<AlertCircle className="size-3.5 shrink-0" />
							<span>Tên chủ tài khoản phải khớp với họ và tên đã đăng ký trên hồ sơ.</span>
						</p>
					)}
					{userFullName && watchedHolderName && isNameMatching && (
						<p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
							<Check className="size-3.5 shrink-0" />
							<span>Tên chủ tài khoản khớp với hồ sơ người dùng.</span>
						</p>
					)}
				</div>

				<div className="pt-1">
					<label className="flex items-center gap-2 cursor-pointer select-none">
						<input
							type="checkbox"
							{...register("isDefault")}
							disabled={addBankAccountMutation.isPending}
							className="size-4 rounded border-[#cbd9ce] text-[#164027] focus:ring-[#164027]"
						/>
						<span className="text-xs font-semibold text-[#10221b]">
							Đặt làm tài khoản ngân hàng mặc định cho rút tiền & hoàn tiền
						</span>
					</label>
				</div>

				<div className="mt-6 flex items-center justify-end gap-3 pt-3">
					<button
						type="button"
						disabled={addBankAccountMutation.isPending}
						onClick={onClose}
						className="rounded-xl border border-[#cbd9ce] px-4 py-2.5 text-xs font-bold text-[#425048] hover:bg-[#f1f5f0] disabled:opacity-50"
					>
						Hủy bỏ
					</button>
					<button
						type="submit"
						disabled={addBankAccountMutation.isPending}
						className="rounded-xl bg-[#164027] px-5 py-2.5 text-xs font-bold text-white shadow transition hover:bg-[#11321f] disabled:cursor-not-allowed disabled:bg-gray-300"
					>
						{addBankAccountMutation.isPending ? "Đang lưu..." : "Lưu tài khoản"}
					</button>
				</div>
			</form>
		</dialog>
	);
}
