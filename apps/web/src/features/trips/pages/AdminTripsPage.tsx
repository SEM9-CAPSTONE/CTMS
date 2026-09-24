import { AlertCircle, CheckCircle, Compass, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminTripReviewContent } from "../components/AdminTripReviewContent";
import { TripReviewDecisionDialog } from "../components/TripReviewDecisionDialog";
import { useAdminTripReviews, useReviewTrip } from "../hooks/useAdminTripReviews";
import type { ReviewTripFormValues } from "../schema/review-trip.schema";

export interface AdminTripsPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminTripsPage({ onLogout }: AdminTripsPageProps) {
	const list = useAdminTripReviews();
	const review = useReviewTrip();
	const [selectedId, setSelectedId] = useState<string>();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	useEffect(() => {
		setSelectedId((current) =>
			current && list.items.some((trip) => trip.id === current) ? current : list.items[0]?.id
		);
	}, [list.items]);

	const selected = useMemo(
		() => list.items.find((trip) => trip.id === selectedId) ?? null,
		[list.items, selectedId]
	);

	const confirm = async (values: ReviewTripFormValues) => {
		if (!selected) return;
		setSuccessMessage(null);
		const result = await review.submit(selected.id, {
			action: values.action,
			reason: values.action === "approve" ? undefined : values.reason,
		});
		if (!result) return;
		const labels = {
			approve: "Đã phê duyệt và xuất bản",
			decline: "Đã trả về bản nháp",
		};
		const message = `${labels[values.action]} trip “${selected.title}”.`;
		setSuccessMessage(message);
		toast.success(message, "Xét duyệt hoàn tất");
		setDialogOpen(false);
		await list.reload();
	};

	return (
		<AdminLayout activeItem="trip-review" onLogout={onLogout}>
			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<header>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold">
						<Compass className="size-7 text-[#164027]" />
						Phê duyệt trip
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Kiểm tra lịch trình, sức chứa và waypoint trước khi xuất bản trip cho Camper.
					</p>
				</header>

				{list.error && (
					<div
						role="alert"
						className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
					>
						<span className="flex items-center gap-2">
							<AlertCircle className="size-5" />
							{list.error}
						</span>
						<button
							type="button"
							onClick={() => void list.reload()}
							className="rounded-lg bg-red-700 px-3 py-2 text-white"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Tải lại
						</button>
					</div>
				)}
				{successMessage && (
					<output className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
						<CheckCircle className="size-5" />
						{successMessage}
					</output>
				)}
				{!list.error && (
					<AdminTripReviewContent
						isLoading={list.isLoading}
						items={list.items}
						selected={selected}
						onSelect={(trip) => {
							setSelectedId(trip.id);
							review.clearError();
							setSuccessMessage(null);
						}}
						onReview={() => {
							review.clearError();
							setSuccessMessage(null);
							setDialogOpen(true);
						}}
					/>
				)}
			</main>
			<TripReviewDecisionDialog
				open={dialogOpen}
				trip={selected}
				isSubmitting={review.isSubmitting}
				error={review.error}
				onClose={() => {
					if (!review.isSubmitting) setDialogOpen(false);
				}}
				onConfirm={confirm}
			/>
		</AdminLayout>
	);
}
