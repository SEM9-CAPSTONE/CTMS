import type { AdminTrekkingRouteReview } from "../types";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

const OUTCOME_LABELS = {
	pending: "Chờ duyệt",
	approved: "Đã phê duyệt",
	returned_for_revision: "Trả về chỉnh sửa",
} as const;

const STATUS_LABELS: Record<AdminTrekkingRouteReview["status"], string> = {
	draft: "Bản nháp",
	pending_approval: "Chờ duyệt",
	active: "Đang hoạt động",
	closed: "Đã đóng",
};

interface Props {
	route: AdminTrekkingRouteReview;
	onReview: () => void;
}

export function AdminRouteReviewDetails({ route, onReview }: Props) {
	const outcome = route.reviewOutcome ?? "pending";
	const canReview = outcome === "pending" && route.status === "pending_approval";
	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-extrabold">{route.name}</h2>
					</div>
					{canReview ? (
						<button
							type="button"
							onClick={onReview}
							className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#276143]"
						>
							Ra quyết định
						</button>
					) : (
						<span className="rounded-xl bg-[#f4f7f2] px-4 py-2 text-sm font-bold text-[#667a6d]">
							Chỉ xem
						</span>
					)}
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-4">
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Kết quả xét duyệt</p>
						<strong>{OUTCOME_LABELS[outcome]}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Trạng thái hiện tại</p>
						<strong>{STATUS_LABELS[route.status]}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Độ khó</p>
						<strong>{route.difficulty}</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Độ dài</p>
						<strong>{route.lengthMeters.toFixed(0)} m</strong>
					</div>
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Thời lượng</p>
						<strong>{route.expectedDurationMinutes} phút</strong>
					</div>
				</div>
			</section>
			<RouteGeometryPreview geometry={route.geometry} dangerZones={route.dangerZones} />
		</div>
	);
}
