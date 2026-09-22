import { Compass, Loader2 } from "lucide-react";
import type { Trip } from "../types";
import { AdminTripReviewDetails } from "./AdminTripReviewDetails";
import { AdminTripReviewList } from "./AdminTripReviewList";

interface AdminTripReviewContentProps {
	isLoading: boolean;
	items: Trip[];
	selected: Trip | null;
	onSelect: (trip: Trip) => void;
	onReview: () => void;
}

export function AdminTripReviewContent({
	isLoading,
	items,
	selected,
	onSelect,
	onReview,
}: AdminTripReviewContentProps) {
	if (isLoading) {
		return (
			<div
				data-testid="trip-reviews-loading"
				className="flex items-center justify-center gap-2 rounded-2xl bg-white p-16 font-bold"
			>
				<Loader2 className="size-5 animate-spin" />
				Đang tải trip chờ duyệt...
			</div>
		);
	}

	if (items.length === 0) {
		return (
			<div
				data-testid="trip-reviews-empty"
				className="rounded-2xl border border-dashed bg-white p-16 text-center"
			>
				<Compass className="mx-auto size-12 text-[#9aaba0]" />
				<p className="mt-3 font-extrabold">Không có trip nào đang chờ duyệt</p>
			</div>
		);
	}

	if (!selected) return null;

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
			<AdminTripReviewList items={items} selectedId={selected.id} onSelect={onSelect} />
			<AdminTripReviewDetails trip={selected} onReview={onReview} />
		</div>
	);
}
