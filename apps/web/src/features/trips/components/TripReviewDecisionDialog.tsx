import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { type ReviewTripFormValues, reviewTripSchema } from "../schema/review-trip.schema";
import type { ReviewTripAction, Trip } from "../types";

interface Props {
	open: boolean;
	trip: Trip | null;
	isSubmitting: boolean;
	error: string;
	onClose: () => void;
	onConfirm: (values: ReviewTripFormValues) => Promise<void>;
}

const decisions: Array<{
	action: ReviewTripAction;
	label: string;
	icon: typeof Check;
	selectedClass: string;
}> = [
	{
		action: "approve",
		label: "Phê duyệt và xuất bản",
		icon: Check,
		selectedClass: "border-emerald-500 bg-emerald-50 text-emerald-800",
	},
	{
		action: "decline",
		label: "Trả về bản nháp",
		icon: AlertTriangle,
		selectedClass: "border-amber-500 bg-amber-50 text-amber-900",
	},
];

export function TripReviewDecisionDialog({
	open,
	trip,
	isSubmitting,
	error,
	onClose,
	onConfirm,
}: Props) {
	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors },
	} = useForm<ReviewTripFormValues>({
		resolver: zodResolver(reviewTripSchema),
		defaultValues: { action: "approve", reason: "" },
	});
	const action = watch("action");
	useEffect(() => {
		if (open && trip) reset({ action: "approve", reason: "" });
	}, [open, reset, trip]);
	if (!open || !trip) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/55 p-4">
			<dialog
				open
				aria-labelledby="trip-review-title"
				className="relative m-0 w-full max-w-2xl rounded-2xl bg-white p-0 text-[#10221b] shadow-2xl"
			>
				<form onSubmit={handleSubmit(onConfirm)}>
					<header className="flex items-start justify-between border-b border-[#e0ebe0] p-5">
						<div>
							<h2 id="trip-review-title" className="text-lg font-extrabold">
								Xét duyệt trip
							</h2>
							<p className="mt-1 text-sm text-[#667a6d]">{trip.title}</p>
						</div>
						<button
							type="button"
							aria-label="Đóng hộp thoại"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-lg p-2 hover:bg-gray-100"
						>
							<X className="size-5" />
						</button>
					</header>
					<div className="space-y-5 p-5">
						<div className="grid gap-3 sm:grid-cols-2">
							{decisions.map((decision) => {
								const Icon = decision.icon;
								return (
									<button
										key={decision.action}
										type="button"
										onClick={() => setValue("action", decision.action, { shouldValidate: true })}
										className={`flex min-h-20 items-center justify-center gap-2 rounded-xl border p-3 text-sm font-extrabold ${action === decision.action ? decision.selectedClass : "border-[#dfe8df] text-[#667a6d]"}`}
									>
										<Icon className="size-4" />
										{decision.label}
									</button>
								);
							})}
						</div>
						{action !== "approve" && (
							<div>
								<label htmlFor="trip-review-reason" className="text-sm font-bold">
									Lý do *
								</label>
								<textarea
									id="trip-review-reason"
									{...register("reason")}
									maxLength={255}
									rows={4}
									disabled={isSubmitting}
									placeholder="Nhập lý do để Host biết nội dung cần chỉnh sửa..."
									className="mt-2 w-full rounded-xl border border-[#cbd9ce] p-3 text-sm outline-none focus:border-[#164027]"
								/>
								{errors.reason && (
									<p className="mt-1 text-xs font-bold text-red-600">{errors.reason.message}</p>
								)}
							</div>
						)}
						{error && (
							<div
								role="alert"
								className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700"
							>
								{error}
							</div>
						)}
					</div>
					<footer className="flex justify-end gap-3 border-t border-[#e0ebe0] bg-[#f8faf7] p-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-xl border px-5 py-2.5 text-sm font-bold"
						>
							Hủy
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
						>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Đang xử lý..." : "Xác nhận quyết định"}
						</button>
					</footer>
				</form>
			</dialog>
		</div>
	);
}
