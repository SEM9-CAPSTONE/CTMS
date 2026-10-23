import { CheckpointList } from "../../trekking-routes/components/CheckpointList";
import { DangerZoneList } from "../../trekking-routes/components/DangerZoneList";
import type { CreatedTrekkingRoute } from "../../trekking-routes/types";
import { useTripRouteSafety } from "../hooks/useTripRouteSafety";

interface Props {
	selectedRoute: CreatedTrekkingRoute | null;
}

export function TripRouteSuggestions({ selectedRoute }: Props) {
	const details = useTripRouteSafety(selectedRoute?.id);
	return (
		<details className="space-y-3" aria-label="Checkpoint của tuyến">
			<summary className="cursor-pointer font-bold">Xem checkpoint và vùng nguy hiểm</summary>
			{selectedRoute && (
				<div className="rounded-2xl border border-emerald-200 bg-white p-4">
					<h3 className="font-bold">Checkpoint và vùng nguy hiểm: {selectedRoute.name}</h3>
					{details.isLoading && <p className="mt-3 text-sm">Đang tải checkpoint...</p>}
					{details.isError && (
						<button
							type="button"
							onClick={() => void details.refetch()}
							className="mt-3 text-sm underline"
						>
							Không tải được checkpoint. Thử lại
						</button>
					)}
					{details.data && (
						<>
							<CheckpointList items={details.data.checkpoints} />
							<DangerZoneList items={details.data.dangerZones} />
							<p className="mt-3 text-xs text-slate-600">
								Dữ liệu đã lưu của tuyến. Host cần kiểm tra thực địa trước chuyến đi; danh sách
								trống không đồng nghĩa tuyến không có nguy hiểm.
							</p>
						</>
					)}
				</div>
			)}
		</details>
	);
}
