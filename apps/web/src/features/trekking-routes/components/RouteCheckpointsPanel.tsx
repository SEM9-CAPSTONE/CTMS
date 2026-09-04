import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useCreateRouteCheckpoint } from "../hooks/useCreateRouteCheckpoint";
import { useCreateRouteDangerZone } from "../hooks/useCreateRouteDangerZone";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import type {
	CreatedTrekkingRoute,
	GeoJsonPoint,
	Position,
	RouteDangerZoneGeometry,
	RouteMapMode,
} from "../types";
import { closePolygonRing } from "../utils/danger-zone-map";
import { CheckpointList } from "./CheckpointList";
import { CreateCheckpointForm } from "./CreateCheckpointForm";
import { CreateRouteDangerZoneForm } from "./CreateRouteDangerZoneForm";
import { DangerZoneList } from "./DangerZoneList";
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
	const dangerZones = useRouteDangerZones(route.id);
	const dangerReload = dangerZones.reload;
	const createDangerZone = useCreateRouteDangerZone(route.id, dangerReload, onRouteReload);
	const [selectedLocation, setSelectedLocation] = useState<GeoJsonPoint>();
	const [radiusMeters, setRadiusMeters] = useState(30);
	const [mapMode, setMapMode] = useState<RouteMapMode>("checkpoint");
	const [dangerGeometry, setDangerGeometry] = useState<RouteDangerZoneGeometry>();
	const [dangerRadiusMeters, setDangerRadiusMeters] = useState(30);
	const [polygonVertices, setPolygonVertices] = useState<Position[]>([]);
	const [polygonError, setPolygonError] = useState("");
	const createDisabled = route.status !== "draft";

	function clearDangerGeometry(): void {
		setDangerGeometry(undefined);
		setPolygonVertices([]);
		setPolygonError("");
	}

	function changeMapMode(mode: RouteMapMode): void {
		setMapMode(mode);
		clearDangerGeometry();
	}

	function selectMapLocation(location: GeoJsonPoint): void {
		if (mapMode === "checkpoint") {
			setSelectedLocation(location);
			return;
		}
		if (mapMode === "hazard-point") {
			setDangerGeometry(location);
			return;
		}
		if (!dangerGeometry) {
			setPolygonVertices((current) => [...current, location.coordinates]);
			setPolygonError("");
		}
	}

	function finishPolygon(): void {
		const polygon = closePolygonRing(polygonVertices);
		if (!polygon) {
			setPolygonError("Đa giác cần ít nhất 3 đỉnh khác nhau.");
			return;
		}
		setDangerGeometry(polygon);
		setPolygonError("");
	}

	function resetDangerDraft(): void {
		clearDangerGeometry();
		setDangerRadiusMeters(30);
		setMapMode("checkpoint");
	}

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
				dangerZones={dangerZones.items}
				mode={mapMode}
				selectedLocation={selectedLocation}
				radiusMeters={radiusMeters}
				proposedHazard={dangerGeometry}
				proposedHazardRadiusMeters={dangerRadiusMeters}
				polygonVertices={polygonVertices}
				disabled={createDisabled}
				onSelectLocation={selectMapLocation}
			/>
			{mapMode === "checkpoint" && selectedLocation && (
				<p className="mt-2 text-xs font-bold text-[#667a6d]">
					Điểm đã chọn: {selectedLocation.coordinates.map((value) => value.toFixed(6)).join(", ")}
				</p>
			)}

			<CreateCheckpointForm
				location={selectedLocation}
				expectedDurationMinutes={route.expectedDurationMinutes}
				disabled={createDisabled || mapMode !== "checkpoint"}
				isSubmitting={create.isSubmitting}
				error={create.error}
				onRadiusChange={setRadiusMeters}
				onSubmit={create.submit}
				onCreated={() => setSelectedLocation(undefined)}
			/>

			<CreateRouteDangerZoneForm
				mode={mapMode}
				geometry={dangerGeometry}
				polygonVertexCount={polygonVertices.length}
				disabled={createDisabled}
				isSubmitting={createDangerZone.isSubmitting}
				error={createDangerZone.error}
				polygonError={polygonError}
				onModeChange={changeMapMode}
				onFinishPolygon={finishPolygon}
				onUndoPolygon={() => {
					setDangerGeometry(undefined);
					setPolygonVertices((current) => current.slice(0, -1));
					setPolygonError("");
				}}
				onClearGeometry={clearDangerGeometry}
				onCancel={resetDangerDraft}
				onRadiusChange={setDangerRadiusMeters}
				onSubmit={createDangerZone.submit}
				onCreated={resetDangerDraft}
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

			<div className="mt-6 border-t border-[#e0ebe0] pt-5">
				<h3 className="font-extrabold">Danh sách khu vực nguy hiểm</h3>
				{dangerZones.isLoading && (
					<p className="mt-3 flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" /> Đang tải khu vực nguy hiểm...
					</p>
				)}
				{dangerZones.error && !dangerZones.isLoading && (
					<div
						role="alert"
						className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
					>
						{dangerZones.error}
						<button
							type="button"
							onClick={() => void dangerZones.reload()}
							className="mt-3 block rounded-lg border px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" /> Tải lại khu vực nguy hiểm
						</button>
					</div>
				)}
				{!dangerZones.isLoading && !dangerZones.error && (
					<DangerZoneList items={dangerZones.items} />
				)}
			</div>
		</section>
	);
}
