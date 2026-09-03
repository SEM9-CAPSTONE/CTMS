import { AlertCircle, RefreshCw, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "../../../shared/components";
import { AdminLayout } from "../../admin-layout/components/AdminLayout";
import { AdminRouteReviewContent } from "../components/AdminRouteReviewContent";
import { RouteReviewDecisionDialog } from "../components/RouteReviewDecisionDialog";
import { useAdminRouteReviews, useReviewTrekkingRoute } from "../hooks/useAdminRouteReviews";
import type { ReviewTrekkingRouteFormValues } from "../schema/review-trekking-route.schema";

export interface AdminTrekkingRoutesPageProps {
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function AdminTrekkingRoutesPage({ onLogout }: AdminTrekkingRoutesPageProps) {
	const list = useAdminRouteReviews();
	const review = useReviewTrekkingRoute();
	const [selectedId, setSelectedId] = useState<string>();
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		setSelectedId((current) =>
			current && list.items.some((route) => route.id === current) ? current : list.items[0]?.id
		);
	}, [list.items]);

	const selected = useMemo(
		() => list.items.find((route) => route.id === selectedId) ?? null,
		[list.items, selectedId]
	);

	const confirm = async (values: ReviewTrekkingRouteFormValues) => {
		if (!selected) return;
		const result = await review.submit(selected.id, {
			action: values.action,
			reason: values.action === "approve" ? undefined : values.reason,
		});
		if (!result) return;
		const labels = {
			approve: "Đã phê duyệt và kích hoạt",
			decline: "Đã trả về bản nháp",
			non_operable: "Đã đóng vì không được vận hành",
		};
		toast.success(`${labels[values.action]} tuyến “${selected.name}”.`, "Xét duyệt hoàn tất");
		setDialogOpen(false);
		await list.reload();
	};

	return (
		<AdminLayout activeItem="route-review" onLogout={onLogout}>
			<main className="mx-auto max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
				<header>
					<h1 className="flex items-center gap-3 text-2xl font-extrabold">
						<Route className="size-7 text-[#164027]" />
						Phê duyệt tuyến trekking
					</h1>
					<p className="mt-1 text-sm text-[#667a6d]">
						Kiểm tra hình học, độ khó và checkpoint trước khi đưa tuyến vào vận hành.
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
				{!list.error && (
					<AdminRouteReviewContent
						isLoading={list.isLoading}
						items={list.items}
						selected={selected}
						onSelect={(route) => {
							setSelectedId(route.id);
							review.clearError();
						}}
						onReview={() => {
							review.clearError();
							setDialogOpen(true);
						}}
					/>
				)}
			</main>
			<RouteReviewDecisionDialog
				open={dialogOpen}
				route={selected}
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
