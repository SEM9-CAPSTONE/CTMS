import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Check, Loader2, ShieldX, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
	type ReviewTrekkingRouteFormValues,
	reviewTrekkingRouteSchema,
} from "../schema/review-trekking-route.schema";
import type { AdminTrekkingRouteReview, ReviewTrekkingRouteAction } from "../types";

interface Props {
	open: boolean;
	route: AdminTrekkingRouteReview | null;
	isSubmitting: boolean;
	error: string;
	onClose: () => void;
	onConfirm: (values: ReviewTrekkingRouteFormValues) => Promise<void>;
}

const decisions: Array<{
	action: ReviewTrekkingRouteAction;
	label: string;
	icon: typeof Check;
	selectedClass: string;
}> = [
	{
		action: "approve",
		label: "Phê duyệt",
		icon: Check,
		selectedClass: "border-emerald-500 bg-emerald-50 text-emerald-800",
	},
	{
		action: "decline",
		label: "Trả về bản nháp",
		icon: AlertTriangle,
		selectedClass: "border-amber-500 bg-amber-50 text-amber-900",
	},
	{
		action: "non_operable",
		label: "Không được vận hành",
		icon: ShieldX,
		selectedClass: "border-red-500 bg-red-50 text-red-800",
	},
];

export function RouteReviewDecisionDialog({
	open,
	route,
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
	} = useForm<ReviewTrekkingRouteFormValues>({
		resolver: zodResolver(reviewTrekkingRouteSchema),
		defaultValues: { action: "approve", reason: "" },
	});
	const action = watch("action");
	useEffect(() => {
		if (open && route) reset({ action: "approve", reason: "" });
	}, [open, reset, route]);
	if (!open || !route) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/55 p-4">
			<dialog
				open
				aria-labelledby="route-review-title"
				className="relative m-0 w-full max-w-2xl rounded-2xl bg-white p-0 text-[#10221b] shadow-2xl"
			>
				<form onSubmit={handleSubmit(onConfirm)}>
					<header className="flex items-start justify-between border-b border-[#e0ebe0] p-5">
						<div>
							<h2 id="route-review-title" className="text-lg font-extrabold">
								Xét duyệt tuyến trekking
							</h2>
							<p className="mt-1 text-sm text-[#667a6d]">{route.name}</p>
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
						<div className="grid gap-3 sm:grid-cols-3">
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
								<label htmlFor="route-review-reason" className="text-sm font-bold">
									Lý do *
								</label>
								<textarea
									id="route-review-reason"
									{...register("reason")}
									maxLength={255}
									rows={4}
									disabled={isSubmitting}
									placeholder="Nhập lý do để Host biết nội dung cần xử lý..."
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
