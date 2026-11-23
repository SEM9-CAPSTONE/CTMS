import { Landmark, Pencil } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { toast } from "../../../shared/components/Toast";
import { createBankAccountSchema } from "../../bank-accounts/schema/bank-account.schema";
import { VIETNAM_POPULAR_BANKS } from "../../booking-refund/constants";
import {
	platformBankAccountErrorMessage,
	usePlatformBankAccount,
	useSavePlatformBankAccount,
} from "../hooks/usePlatformBankAccount";
import type { platformBankAccountService } from "../services/platform-bank-account.service";
import type { PlatformBankAccountInput } from "../types";

const accountSchema = createBankAccountSchema.omit({ isDefault: true });
type FieldErrors = Partial<Record<keyof PlatformBankAccountInput, string>>;

const EMPTY: PlatformBankAccountInput = {
	bankName: VIETNAM_POPULAR_BANKS[0],
	accountNumber: "",
	accountHolderName: "",
};

function formatDateTime(value: string): string {
	return new Date(value).toLocaleString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export interface PlatformBankAccountPanelProps {
	service?: typeof platformBankAccountService;
}

/**
 * Admin › Tài chính: the account Hosts transfer a weather penalty to when settlements did not cover
 * it. Shown to Hosts on their wallet as soon as it is saved.
 */
export function PlatformBankAccountPanel({ service }: PlatformBankAccountPanelProps) {
	const ids = { bank: useId(), number: useId(), holder: useId() };
	const query = usePlatformBankAccount(service);
	const save = useSavePlatformBankAccount(service);
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState<PlatformBankAccountInput>(EMPTY);
	const [errors, setErrors] = useState<FieldErrors>({});
	const [confirming, setConfirming] = useState<PlatformBankAccountInput | null>(null);
	const account = query.data ?? null;
	const showForm = editing || (query.isSuccess && !account);
	const bankOptions =
		form.bankName && !VIETNAM_POPULAR_BANKS.includes(form.bankName as never)
			? [form.bankName, ...VIETNAM_POPULAR_BANKS]
			: VIETNAM_POPULAR_BANKS;

	function startEditing() {
		setForm(
			account
				? {
						bankName: account.bankName,
						accountNumber: account.accountNumber,
						accountHolderName: account.accountHolderName,
					}
				: EMPTY
		);
		setErrors({});
		setEditing(true);
	}

	function review() {
		const parsed = accountSchema.safeParse({
			bankName: form.bankName.trim(),
			accountNumber: form.accountNumber.trim(),
			accountHolderName: form.accountHolderName.trim(),
		});
		if (!parsed.success) {
			const next: FieldErrors = {};
			for (const issue of parsed.error.issues) {
				const field = issue.path[0] as keyof PlatformBankAccountInput;
				next[field] ??= issue.message;
			}
			setErrors(next);
			return;
		}
		setErrors({});
		setConfirming(parsed.data);
	}

	async function submit() {
		if (!confirming) return;
		try {
			await save.mutateAsync(confirming);
			toast.success("Đã lưu tài khoản nhận tiền phạt. Host sẽ thấy thông tin mới trong Ví.");
			setEditing(false);
		} catch (error) {
			toast.error(platformBankAccountErrorMessage(error));
		} finally {
			setConfirming(null);
		}
	}

	return (
		<section
			data-testid="platform-bank-account-panel"
			className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e7eee7] pb-4">
				<div className="flex min-w-0 flex-1 items-start gap-3">
					<div className="rounded-2xl bg-[#f1f5f0] p-3 text-[#164027]">
						<Landmark className="size-5" />
					</div>
					<div>
						<h2 className="text-base font-extrabold text-[#10221b]">Tài khoản nhận tiền phạt</h2>
						<p className="mt-1 text-xs text-[#667a6d]">
							Host chuyển khoản vào tài khoản này khi tiền phạt thời tiết chưa được trừ đủ qua quyết
							toán. Thông tin hiện ngay trong Ví của Host sau khi bạn lưu.
						</p>
					</div>
				</div>
				{account && !showForm && (
					<button
						type="button"
						onClick={startEditing}
						className="inline-flex items-center gap-2 rounded-xl border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#164027] hover:bg-[#f1f5f0]"
					>
						<Pencil className="size-4" /> Đổi tài khoản
					</button>
				)}
			</div>

			{query.isPending && <p className="mt-4 text-sm text-[#667a6d]">Đang tải...</p>}
			{query.isError && (
				<div className="mt-4 text-sm text-rose-700">
					<p>Không tải được tài khoản nhận tiền.</p>
					<button type="button" onClick={() => void query.refetch()} className="mt-1 underline">
						Thử lại
					</button>
				</div>
			)}

			{account && !showForm && (
				<dl
					data-testid="platform-bank-account-current"
					className="mt-4 grid gap-3 rounded-2xl border border-[#edf3ed] bg-[#fbfdfb] p-4 text-sm sm:grid-cols-3"
				>
					<div>
						<dt className="text-xs text-[#7d8d83]">Ngân hàng</dt>
						<dd className="font-bold">{account.bankName}</dd>
					</div>
					<div>
						<dt className="text-xs text-[#7d8d83]">Số tài khoản</dt>
						<dd className="font-bold tracking-wide">{account.accountNumber}</dd>
					</div>
					<div>
						<dt className="text-xs text-[#7d8d83]">Chủ tài khoản</dt>
						<dd className="font-bold">{account.accountHolderName}</dd>
					</div>
					<p className="text-xs text-[#667a6d] sm:col-span-3">
						Cập nhật lúc {formatDateTime(account.updatedAt)}
						{account.updatedByName ? ` bởi ${account.updatedByName}` : ""}.
					</p>
				</dl>
			)}

			{showForm && (
				<div className="mt-4 space-y-4" data-testid="platform-bank-account-form">
					{!account && (
						<p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
							Chưa có tài khoản nhận tiền phạt. Host đang được hướng dẫn liên hệ quản trị viên để
							nhận thông tin chuyển khoản.
						</p>
					)}
					<div className="grid gap-4 sm:grid-cols-3">
						<div>
							<label htmlFor={ids.bank} className="text-xs font-extrabold">
								Ngân hàng
							</label>
							<select
								id={ids.bank}
								value={form.bankName}
								onChange={(event) => setForm({ ...form, bankName: event.target.value })}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2 text-sm outline-none focus:border-[#164027]"
							>
								{bankOptions.map((bank) => (
									<option key={bank} value={bank}>
										{bank}
									</option>
								))}
							</select>
							{errors.bankName && (
								<p className="mt-1 text-xs font-semibold text-rose-700">{errors.bankName}</p>
							)}
						</div>
						<div>
							<label htmlFor={ids.number} className="text-xs font-extrabold">
								Số tài khoản
							</label>
							<input
								id={ids.number}
								value={form.accountNumber}
								maxLength={20}
								inputMode="numeric"
								onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
								aria-invalid={Boolean(errors.accountNumber)}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm outline-none focus:border-[#164027]"
							/>
							{errors.accountNumber && (
								<p className="mt-1 text-xs font-semibold text-rose-700">{errors.accountNumber}</p>
							)}
						</div>
						<div>
							<label htmlFor={ids.holder} className="text-xs font-extrabold">
								Tên chủ tài khoản
							</label>
							<input
								id={ids.holder}
								value={form.accountHolderName}
								maxLength={100}
								onChange={(event) =>
									setForm({ ...form, accountHolderName: event.target.value.toUpperCase() })
								}
								aria-invalid={Boolean(errors.accountHolderName)}
								className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2 text-sm outline-none focus:border-[#164027]"
							/>
							{errors.accountHolderName && (
								<p className="mt-1 text-xs font-semibold text-rose-700">
									{errors.accountHolderName}
								</p>
							)}
						</div>
					</div>
					<div className="flex justify-end gap-2">
						{account && (
							<button
								type="button"
								onClick={() => setEditing(false)}
								disabled={save.isPending}
								className="rounded-xl border border-[#dfe8df] bg-white px-4 py-2 text-xs font-bold text-[#164027] hover:bg-[#f1f5f0] disabled:opacity-50"
							>
								Huỷ
							</button>
						)}
						<button
							type="button"
							onClick={review}
							disabled={save.isPending}
							className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#0d2617] disabled:opacity-50"
						>
							Lưu tài khoản
						</button>
					</div>
				</div>
			)}

			<ConfirmModal
				isOpen={confirming !== null}
				onClose={() => setConfirming(null)}
				onConfirm={submit}
				title="Lưu tài khoản nhận tiền phạt?"
				description={
					confirming
						? `${confirming.bankName} · ${confirming.accountNumber} · ${confirming.accountHolderName}. Host sẽ chuyển tiền phạt vào tài khoản này.`
						: ""
				}
				confirmText="Lưu"
				cancelText="Quay lại"
				variant="success"
				isLoading={save.isPending}
			/>
		</section>
	);
}
