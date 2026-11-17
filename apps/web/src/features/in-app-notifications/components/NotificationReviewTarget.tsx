import { AdminTripReviewDetails } from "../../trips/components/AdminTripReviewDetails";
import type { ReturnTypeOfNotificationTarget } from "../types";
import { notificationError } from "../utils/notification-view";

interface Props {
	target: ReturnTypeOfNotificationTarget;
	onReview: () => void;
}

export function NotificationReviewTarget({ target, onReview }: Props) {
	if (target.query.isPending)
		return (
			<output className="block rounded-xl bg-white p-6">Đang tải chuyến đi từ thông báo…</output>
		);
	if (target.query.isError)
		return (
			<div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-red-700">
				{notificationError(target.query.error)}
				<button
					type="button"
					onClick={() => void target.query.refetch()}
					className="ml-3 font-semibold underline"
				>
					Tải lại
				</button>
			</div>
		);
	if (!target.review)
		return (
			<div className="space-y-3 rounded-xl border bg-white p-6">
				<p>Chuyến đi đã được xử lý hoặc không còn chờ xét duyệt.</p>
				{target.query.data && (
					<a
						className="font-semibold text-brand-primary underline"
						href={`/trips/${encodeURIComponent(target.query.data.id)}?from=notification`}
					>
						Xem thông tin chuyến đi hiện tại
					</a>
				)}
			</div>
		);
	return (
		<div className="space-y-3">
			<p className="text-sm text-slate-600">Chuyến đi cần xét duyệt</p>
			<AdminTripReviewDetails trip={target.review} onReview={onReview} />
		</div>
	);
}
