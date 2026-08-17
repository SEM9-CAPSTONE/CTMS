import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2, Lock, Unlock, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type AccountStatusActionFormValues,
	accountStatusActionSchema,
} from "../schema/account-status-action.schema";
import type { AccountAction, UserAccountSummary } from "../types";

export interface AccountStatusDialogProps {
	open: boolean;
	action: AccountAction;
	user: UserAccountSummary | null;
	isSubmitting: boolean;
	errorMessage: string | null;
	onClose: () => void;
	onConfirm: (reason?: string) => Promise<void>;
}

export function AccountStatusDialog(props: AccountStatusDialogProps) {
	const form = useForm<AccountStatusActionFormValues>({
		resolver: zodResolver(accountStatusActionSchema),
		defaultValues: { reason: "" },
	});
	useEffect(() => {
		if (props.open) form.reset({ reason: "" });
	}, [form, props.open]);
	if (!props.open || !props.user) return null;
	const isLock = props.action === "lock";
	const Icon = isLock ? Lock : Unlock;
	const displayName = props.user.fullName || props.user.email || props.user.phone || props.user.id;
	const submit = form.handleSubmit(async (values) =>
		props.onConfirm(values.reason?.trim() || undefined)
	);

	return (
		<div
			aria-modal="true"
			className="fixed inset-0 z-[60] flex items-center justify-center bg-[#10221b]/50 p-4"
			aria-labelledby="account-action-title"
		>
			<div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
				<div className="flex items-center justify-between border-b border-[#e0ebe0] px-5 py-4">
					<h2 id="account-action-title" className="text-lg font-extrabold text-[#10221b]">
						{isLock ? "Khóa tài khoản" : "Mở khóa tài khoản"}
					</h2>
					<button
						type="button"
						onClick={props.onClose}
						disabled={props.isSubmitting}
						aria-label="Đóng xác nhận"
						className="rounded-lg p-2 text-[#667a6d] hover:bg-[#f4f7f2]"
					>
						<X className="size-5" />
					</button>
				</div>
				<form onSubmit={submit} className="space-y-4 p-5">
					<div
						className={`flex gap-3 rounded-xl border p-4 ${isLock ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}
					>
						<AlertTriangle
							className={`size-5 shrink-0 ${isLock ? "text-amber-600" : "text-emerald-600"}`}
						/>
						<p className="text-sm text-[#425048]">
							Bạn có chắc muốn {isLock ? "khóa" : "mở khóa"} tài khoản{" "}
							<strong>{displayName}</strong>?
						</p>
					</div>
					<label className="block">
						<span className="mb-2 block text-sm font-bold text-[#425048]">
							Lý do (không bắt buộc)
						</span>
						<textarea
							{...form.register("reason")}
							rows={3}
							maxLength={255}
							disabled={props.isSubmitting}
							className="w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm outline-none focus:border-[#164027]"
							placeholder="Nhập lý do cho audit log"
						/>
						{form.formState.errors.reason && (
							<span className="mt-1 block text-xs font-semibold text-red-600">
								{form.formState.errors.reason.message}
							</span>
						)}
					</label>
					{props.errorMessage && (
						<div
							role="alert"
							className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700"
						>
							{props.errorMessage}
						</div>
					)}
					<div className="flex justify-end gap-3">
						<button
							type="button"
							onClick={props.onClose}
							disabled={props.isSubmitting}
							className="rounded-xl border border-[#dfe8df] px-4 py-2 text-sm font-bold text-[#425048] disabled:opacity-50"
						>
							Hủy
						</button>
						<button
							type="submit"
							disabled={props.isSubmitting}
							className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${isLock ? "bg-red-600 hover:bg-red-700" : "bg-[#164027] hover:bg-[#276143]"}`}
						>
							{props.isSubmitting ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<Icon className="size-4" />
							)}
							{props.isSubmitting ? "Đang xử lý..." : isLock ? "Xác nhận khóa" : "Xác nhận mở khóa"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
