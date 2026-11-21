import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button, ConfirmModal } from "../../../shared/components";
import { type HotspotReviewFormValues, hotspotReviewSchema } from "../schema/hotspot-review.schema";
import type { HotspotReviewTarget } from "../types";

interface Props {
	submitting: boolean;
	onReview: (status: HotspotReviewTarget, reason: string) => Promise<boolean>;
}

const DECISION_COPY: Record<
	HotspotReviewTarget,
	{ title: string; description: string; confirmText: string; variant: "success" | "danger" }
> = {
	CONFIRMED: {
		title: "Xác nhận điểm nóng",
		description: "Điểm nóng được ghi nhận là nguy hiểm thật trên tuyến.",
		confirmText: "Xác nhận",
		variant: "success",
	},
	DISMISSED: {
		title: "Bác bỏ điểm nóng",
		description: "Điểm nóng được ghi nhận là không nguy hiểm.",
		confirmText: "Bác bỏ",
		variant: "danger",
	},
};

/** CTMS-117 review step; a reason is kept with every decision. */
export function HotspotReviewForm({ submitting, onReview }: Props) {
	const [pending, setPending] = useState<HotspotReviewTarget | null>(null);
	const {
		register,
		handleSubmit,
		getValues,
		reset,
		formState: { errors },
	} = useForm<HotspotReviewFormValues>({
		resolver: zodResolver(hotspotReviewSchema),
		defaultValues: { reason: "" },
	});

	const submit = async (status: HotspotReviewTarget) => {
		const saved = await onReview(status, getValues("reason").trim());
		if (saved) reset({ reason: "" });
		setPending(null);
	};

	return (
		<form className="space-y-3" onSubmit={(event) => event.preventDefault()}>
			<div className="space-y-1.5">
				<label
					htmlFor="hotspot-review-reason"
					className="text-xs font-medium tracking-wide text-[#667a6d]"
				>
					Lý do
				</label>
				<textarea
					id="hotspot-review-reason"
					rows={3}
					{...register("reason")}
					disabled={submitting}
					className="w-full rounded-xl border border-[#dfe8df] bg-white p-3 text-sm text-[#10221b] transition-colors duration-150 focus:border-[#164027] focus:outline-none disabled:opacity-60"
				/>
				{errors.reason && (
					<p role="alert" className="text-xs text-rose-700">
						{errors.reason.message}
					</p>
				)}
			</div>
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					disabled={submitting}
					onClick={handleSubmit(() => setPending("DISMISSED"))}
				>
					Bác bỏ
				</Button>
				<Button
					type="button"
					disabled={submitting}
					onClick={handleSubmit(() => setPending("CONFIRMED"))}
				>
					Xác nhận điểm nóng
				</Button>
			</div>

			<ConfirmModal
				isOpen={pending !== null}
				onClose={() => setPending(null)}
				onConfirm={() => (pending ? submit(pending) : undefined)}
				isLoading={submitting}
				variant={pending ? DECISION_COPY[pending].variant : "success"}
				title={pending ? DECISION_COPY[pending].title : ""}
				description={pending ? DECISION_COPY[pending].description : ""}
				confirmText={pending ? DECISION_COPY[pending].confirmText : "Xác nhận"}
				cancelText="Quay lại"
			/>
		</form>
	);
}
