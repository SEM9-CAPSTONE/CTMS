import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "../../../shared/components/Toast";
import { CHECKPOINT_RADIUS_METERS } from "../constants";
import { useCreateRouteCheckpoint } from "../hooks/useCreateRouteCheckpoint";
import { useCreateRouteDangerZone } from "../hooks/useCreateRouteDangerZone";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import { useUpdateRouteCheckpoint } from "../hooks/useUpdateRouteCheckpoint";
import type {
	CreatedTrekkingRoute,
	GeoJsonPoint,
	Position,
	RouteCheckpoint,
	RouteCheckpointType,
	RouteDangerZone,
	RouteDangerZoneGeometry,
	RouteMapMode,
} from "../types";
import { closePolygonRing } from "../utils/danger-zone-map";
import { nearestRoutePoint } from "../utils/route-snap";
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
	onCheckpointsChange?: (checkpoints: RouteCheckpoint[]) => void;
	onDangerZonesChange?: (dangerZones: RouteDangerZone[]) => void;
}

export function RouteCheckpointsPanel({
	route,
	onRouteReload,
	onRouteSubmitted,
	onCheckpointsChange,
	onDangerZonesChange,
}: RouteCheckpointsPanelProps) {
	const checkpoints = useRouteCheckpoints(route.id);
	const reload = checkpoints.reload;
	const create = useCreateRouteCheckpoint(route.id, reload);
	const update = useUpdateRouteCheckpoint(route.id, reload);
	const dangerZones = useRouteDangerZones(route.id);
	const dangerReload = dangerZones.reload;
	const createDangerZone = useCreateRouteDangerZone(route.id, dangerReload, onRouteReload);
	const [selectedLocation, setSelectedLocation] = useState<GeoJsonPoint>();
	const [mapMode, setMapMode] = useState<RouteMapMode>("checkpoint");
	const [dangerGeometry, setDangerGeometry] = useState<RouteDangerZoneGeometry>();
	const [dangerRadiusMeters, setDangerRadiusMeters] = useState(30);
	const [polygonVertices, setPolygonVertices] = useState<Position[]>([]);
	const [polygonError, setPolygonError] = useState("");
	const [editingCheckpoint, setEditingCheckpoint] = useState<RouteCheckpoint>();
	const [checkpointType, setCheckpointType] = useState<RouteCheckpointType>();
	const toast = useToast();
	const createDisabled = route.status !== "draft";

	useEffect(() => {
		onCheckpointsChange?.(
			checkpoints.items.filter((checkpoint) => checkpoint.routeId === route.id)
		);
	}, [checkpoints.items, onCheckpointsChange, route.id]);

	useEffect(() => {
		onDangerZonesChange?.(
			dangerZones.items.filter((dangerZone) => dangerZone.routeId === route.id)
		);
	}, [dangerZones.items, onDangerZonesChange, route.id]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: route.id intentionally resets local drafts when the selected route changes
	useEffect(() => {
		setEditingCheckpoint(undefined);
		setSelectedLocation(undefined);
	}, [route.id]);

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
			// Route locations must sit on the line, like trip waypoints, so snap the click onto it.
			const snapped = nearestRoutePoint(location.coordinates, route.geometry.coordinates);
			setSelectedLocation({ type: "Point", coordinates: snapped.position });
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
			setPolygonError("Khu vực cần ít nhất 3 đỉnh khác nhau.");
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

	function beginCheckpointEdit(checkpoint: RouteCheckpoint): void {
		setMapMode("checkpoint");
		clearDangerGeometry();
		setEditingCheckpoint(checkpoint);
		setSelectedLocation(checkpoint.location);
	}

	function cancelCheckpointEdit(): void {
		setEditingCheckpoint(undefined);
		setSelectedLocation(undefined);
	}

	return (
		<section
			className="mt-6 rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm"
			data-testid="route-checkpoints-panel"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 className="font-extrabold text-[#10221b]">Vị trí trên tuyến</h2>
					<p className="mt-1 text-sm text-[#667a6d]">
						Nhấp lên bản đồ để chọn vị trí; điểm chọn sẽ được gắn vào đường tuyến gần nhất.
					</p>
				</div>
				{createDisabled && (
					<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
						Đang chờ duyệt
					</span>
				)}
			</div>

			<RouteCheckpointMap
				geometry={route.geometry}
				checkpoints={checkpoints.items}
				dangerZones={dangerZones.items}
				mode={mapMode}
				selectedLocation={selectedLocation}
				radiusMeters={CHECKPOINT_RADIUS_METERS}
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
			{mapMode === "checkpoint" && (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className="text-xs font-semibold text-[#667a6d]">Chọn nhanh vị trí:</span>
					<button
						type="button"
						disabled={createDisabled}
						onClick={() => {
							const startCoord = route.geometry.coordinates[0];
							if (startCoord) {
								setSelectedLocation({ type: "Point", coordinates: startCoord });
								setCheckpointType("start");
							}
						}}
						className="rounded-lg border border-[#cbd9ce] bg-[#f8fbf7] px-3 py-1 text-xs font-bold text-[#10221b] hover:bg-[#e0ebe0] disabled:cursor-not-allowed disabled:opacity-50"
					>
						📍 Điểm đầu tuyến (Start)
					</button>
					<button
						type="button"
						disabled={createDisabled}
						onClick={() => {
							const finishCoord = route.geometry.coordinates.at(-1);
							if (finishCoord) {
								setSelectedLocation({ type: "Point", coordinates: finishCoord });
								setCheckpointType("finish");
							}
						}}
						className="rounded-lg border border-[#cbd9ce] bg-[#f8fbf7] px-3 py-1 text-xs font-bold text-[#10221b] hover:bg-[#e0ebe0] disabled:cursor-not-allowed disabled:opacity-50"
					>
						🏁 Điểm cuối tuyến (Finish)
					</button>
				</div>
			)}

			{mapMode === "checkpoint" ? (
				<CreateCheckpointForm
					key={editingCheckpoint?.id ?? route.id}
					checkpoint={editingCheckpoint}
					location={selectedLocation}
					initialType={checkpointType}
					onSelectDangerArea={() => changeMapMode("hazard-polygon")}
					disabled={createDisabled}
					isSubmitting={editingCheckpoint ? update.isSubmitting : create.isSubmitting}
					error={editingCheckpoint ? update.error : create.error}
					onSubmit={(payload) =>
						editingCheckpoint
							? update.submit(editingCheckpoint.id, payload)
							: create.submit(payload)
					}
					onCreated={() => {
						toast.success(editingCheckpoint ? "Đã cập nhật vị trí." : "Đã thêm vị trí.");
						setEditingCheckpoint(undefined);
						setSelectedLocation(undefined);
						setCheckpointType(undefined);
					}}
					onCancel={cancelCheckpointEdit}
				/>
			) : (
				<CreateRouteDangerZoneForm
					mode={mapMode}
					geometry={dangerGeometry}
					polygonVertexCount={polygonVertices.length}
					disabled={createDisabled}
					isSubmitting={createDangerZone.isSubmitting}
					error={createDangerZone.error}
					polygonError={polygonError}
					onSelectCheckpointType={(type) => {
						setCheckpointType(type);
						changeMapMode("checkpoint");
					}}
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
			)}

			<div className="mt-6 border-t border-[#e0ebe0] pt-5">
				<h3 className="font-extrabold">Danh sách các vị trí trên tuyến</h3>
				{checkpoints.isLoading && (
					<p className="mt-3 flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" /> Đang tải vị trí...
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
					<CheckpointList
						items={checkpoints.items}
						disabled={createDisabled || update.isSubmitting}
						onEdit={beginCheckpointEdit}
					/>
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
			<RouteSubmissionPanel route={route} onReload={onRouteReload} onSubmitted={onRouteSubmitted} />
		</section>
	);
}
