import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useCreateRouteCheckpoint } from "../hooks/useCreateRouteCheckpoint";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import type { CreatedTrekkingRoute, GeoJsonPoint } from "../types";
import { CheckpointList } from "./CheckpointList";
import { CreateCheckpointForm } from "./CreateCheckpointForm";
import { RouteCheckpointMap } from "./RouteCheckpointMap";
import { RouteSubmissionPanel } from "./RouteSubmissionPanel";

interface RouteCheckpointsPanelProps {
	route: CreatedTrekkingRoute;
	onRouteReload: () => Promise<unknown>;
	onRouteSubmitted: (route: CreatedTrekkingRoute) => void;
}

export function RouteCheckpointsPanel({
	route,
	onRouteReload,
	onRouteSubmitted,
}: RouteCheckpointsPanelProps) {
	const checkpoints = useRouteCheckpoints(route.id);
	const reload = checkpoints.reload;
	const create = useCreateRouteCheckpoint(route.id, reload);
	const [selectedLocation, setSelectedLocation] = useState<GeoJsonPoint>();
	const [radiusMeters, setRadiusMeters] = useState(30);
	const createDisabled = route.status !== "draft";

	return (
		<section
			className="mt-6 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-checkpoints-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Checkpoint trên tuyến</h2>
					<p className="mt-1 text-sm text-[#667a6d]">
						Chọn một điểm trên bản đồ; máy chủ sẽ chấp nhận điểm cách tuyến tối đa 50 mét.
					</p>
				</div>
				{createDisabled && (
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
						Chỉ xem — tuyến không còn ở trạng thái nháp
					</span>
				)}
			</div>

			<RouteSubmissionPanel
				route={route}
				checkpoints={checkpoints.items}
				isLoadingCheckpoints={checkpoints.isLoading}
				checkpointError={checkpoints.error}
				onReload={onRouteReload}
				onSubmitted={onRouteSubmitted}
			/>

			<RouteCheckpointMap
				geometry={route.geometry}
				checkpoints={checkpoints.items}
				selectedLocation={selectedLocation}
				radiusMeters={radiusMeters}
				disabled={createDisabled}
				onSelectLocation={setSelectedLocation}
			/>
			{selectedLocation && (
				<p className="mt-2 text-xs font-bold text-[#667a6d]">
					Điểm đã chọn: {selectedLocation.coordinates.map((value) => value.toFixed(6)).join(", ")}
				</p>
			)}

			<CreateCheckpointForm
				location={selectedLocation}
				expectedDurationMinutes={route.expectedDurationMinutes}
				disabled={createDisabled}
				isSubmitting={create.isSubmitting}
				error={create.error}
				onRadiusChange={setRadiusMeters}
				onSubmit={create.submit}
				onCreated={() => setSelectedLocation(undefined)}
			/>

			<div className="mt-6 border-t border-[#e0ebe0] pt-5">
				<h3 className="font-extrabold">Danh sách checkpoint</h3>
				{checkpoints.isLoading && (
					<p className="mt-3 flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" /> Đang tải checkpoint...
					</p>
				)}
				{checkpoints.error && !checkpoints.isLoading && (
					<div
						role="alert"
						className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
					>
						{checkpoints.error}
						<button
							type="button"
							onClick={() => void checkpoints.reload()}
							className="mt-3 block rounded-lg border px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" /> Tải lại
						</button>
					</div>
				)}
				{!checkpoints.isLoading && !checkpoints.error && (
					<CheckpointList items={checkpoints.items} />
				)}
			</div>
		</section>
	);
}
