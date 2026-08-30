import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, RotateCcw, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ROUTE_STATUS_ACTION_CONTENT, lifecycleActionForStatus } from "../constants";
import { useRouteStatusAction } from "../hooks/useRouteStatusAction";
import {
	type RouteStatusActionFormValues,
	routeStatusActionSchema,
} from "../schema/route-status-action.schema";
import type { CreatedTrekkingRoute } from "../types";

interface RouteStatusActionDialogProps {
	route: CreatedTrekkingRoute;
	onReload: () => Promise<unknown>;
}

export function RouteStatusActionDialog({ route, onReload }: RouteStatusActionDialogProps) {
	const action = lifecycleActionForStatus(route.status);
	const [open, setOpen] = useState(false);
	const lifecycle = useRouteStatusAction();
	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<RouteStatusActionFormValues>({
		resolver: zodResolver(routeStatusActionSchema),
		defaultValues: { reason: "" },
	});

	if (!action) return null;
	const content = ROUTE_STATUS_ACTION_CONTENT[action];
	const reasonLength = watch("reason").length;
	const closeDialog = () => {
		if (lifecycle.isSubmitting) return;
		setOpen(false);
		reset();
		lifecycle.resetError();
	};
	const submit = handleSubmit(async (values) => {
		const updated = await lifecycle.submit(action, route.id, values);
		if (!updated) return;
		await onReload();
		setOpen(false);
		reset();
	});

	return (
		<section className="mt-4 flex justify-end" aria-label="Thao tác trạng thái tuyến đường">
			<button
				type="button"
				onClick={() => {
					lifecycle.resetError();
					setOpen(true);
				}}
				className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-extrabold ${
					action === "close"
						? "bg-red-700 text-white hover:bg-red-800"
						: "bg-[#164027] text-white hover:bg-[#0f3020]"
				}`}
			>
				{action === "close" ? <ShieldAlert className="size-4" /> : <RotateCcw className="size-4" />}
				{content.trigger}
			</button>

			{open && (
				<div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
					<dialog
						open
						aria-modal="true"
						aria-labelledby="route-status-dialog-title"
						className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<h2
									id="route-status-dialog-title"
									className="text-lg font-extrabold text-[#10221b]"
								>
									{content.title}
								</h2>
								<p className="mt-2 text-sm text-[#52665b]">{content.description}</p>
							</div>
							<button
								type="button"
								aria-label="Đóng hộp thoại"
								disabled={lifecycle.isSubmitting}
								onClick={closeDialog}
							>
								<X className="size-5" />
							</button>
						</div>

						<form className="mt-5" onSubmit={submit}>
							<label
								className="text-sm font-extrabold text-[#34483b]"
								htmlFor="route-status-reason"
							>
								Lý do
							</label>
							<textarea
								id="route-status-reason"
								rows={4}
								maxLength={255}
								disabled={lifecycle.isSubmitting}
								className="mt-2 w-full rounded-xl border border-[#cbd9ce] px-3 py-2.5 outline-none focus:border-[#164027]"
								{...register("reason")}
							/>
							<div className="mt-1 flex justify-between gap-3 text-xs">
								<span className="font-semibold text-red-600">{errors.reason?.message}</span>
								<span className="text-[#667a6d]">{reasonLength}/255</span>
							</div>
							{lifecycle.error && (
								<div
									role="alert"
									className="mt-3 flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
								>
									<AlertCircle className="size-5 shrink-0" />
									{lifecycle.error.message}
								</div>
							)}
							<div className="mt-5 flex justify-end gap-3">
								<button
									type="button"
									disabled={lifecycle.isSubmitting}
									onClick={closeDialog}
									className="rounded-xl border px-4 py-2.5 font-bold"
								>
									Hủy
								</button>
								<button
									type="submit"
									disabled={lifecycle.isSubmitting}
									className={`flex items-center gap-2 rounded-xl px-4 py-2.5 font-extrabold text-white disabled:opacity-60 ${action === "close" ? "bg-red-700" : "bg-[#164027]"}`}
								>
									{lifecycle.isSubmitting && <Loader2 className="size-4 animate-spin" />}
									{lifecycle.isSubmitting ? content.pending : content.submit}
								</button>
							</div>
						</form>
					</dialog>
				</div>
			)}
		</section>
	);
}
