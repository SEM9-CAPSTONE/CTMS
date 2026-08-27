import { Loader2, Route } from "lucide-react";
import type { AdminTrekkingRouteReview } from "../types";
import { AdminRouteReviewDetails } from "./AdminRouteReviewDetails";
import { AdminRouteReviewList } from "./AdminRouteReviewList";

interface AdminRouteReviewContentProps {
	isLoading: boolean;
	items: AdminTrekkingRouteReview[];
	selected: AdminTrekkingRouteReview | null;
	onSelect: (route: AdminTrekkingRouteReview) => void;
	onReview: () => void;
}

export function AdminRouteReviewContent({
	isLoading,
	items,
	selected,
	onSelect,
	onReview,
}: AdminRouteReviewContentProps) {
	if (isLoading) {
		return (
			<div
				data-testid="route-reviews-loading"
				className="flex items-center justify-center gap-2 rounded-2xl bg-white p-16 font-bold"
			>
				<Loader2 className="size-5 animate-spin" />
				Đang tải tuyến chờ duyệt...
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div
				data-testid="route-reviews-empty"
				className="rounded-2xl border border-dashed bg-white p-16 text-center"
			>
				<Route className="mx-auto size-12 text-[#9aaba0]" />
				<p className="mt-3 font-extrabold">Không có tuyến nào đang chờ duyệt</p>
			</div>
		);
	}

	if (!selected) return null;

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
			<AdminRouteReviewList items={items} selectedId={selected.id} onSelect={onSelect} />
			<AdminRouteReviewDetails route={selected} onReview={onReview} />
		</div>
	);
}
