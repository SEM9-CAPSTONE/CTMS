import type { AdminTrekkingRouteReview } from "../types";
import { CheckpointList } from "./CheckpointList";
import { RouteGeometryPreview } from "./RouteGeometryPreview";

interface Props {
	route: AdminTrekkingRouteReview;
	onReview: () => void;
}

export function AdminRouteReviewDetails({ route, onReview }: Props) {
	return (
		<div className="space-y-5">
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div>
						<h2 className="text-xl font-extrabold">{route.name}</h2>
						<p className="mt-1 text-sm text-[#667a6d]">Khu cắm trại: {route.campsiteName}</p>
					</div>
					<button
						type="button"
						onClick={onReview}
						className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-extrabold text-white hover:bg-[#276143]"
					>
						Ra quyết định
					</button>
				</div>
				<div className="mt-5 grid gap-3 sm:grid-cols-4">
					<div className="rounded-xl bg-[#f4f7f2] p-3">
						<p className="text-xs text-[#667a6d]">Trạng thái</p>
						<strong>Chờ duyệt</strong>
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
			<RouteGeometryPreview geometry={route.geometry} />
			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<h2 className="font-extrabold">Checkpoint theo thứ tự tuyến</h2>
				<CheckpointList items={route.checkpoints} />
			</section>
		</div>
	);
}
