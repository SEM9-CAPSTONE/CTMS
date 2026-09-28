import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
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
	RouteDangerZone,
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
	const [checkpointNotice, setCheckpointNotice] = useState("");
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
		setCheckpointNotice("");
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

	function beginCheckpointEdit(checkpoint: RouteCheckpoint): void {
		setMapMode("checkpoint");
		clearDangerGeometry();
		setEditingCheckpoint(checkpoint);
		setSelectedLocation(checkpoint.location);
		setCheckpointNotice("");
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
					<h2 className="font-extrabold text-[#10221b]">Điểm dừng trên tuyến</h2>
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
			{checkpointNotice && (
				<output className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
					{checkpointNotice}
				</output>
			)}
			{mapMode === "checkpoint" && selectedLocation && (
				<p className="mt-2 text-xs font-bold text-[#667a6d]">
					Điểm đã chọn: {selectedLocation.coordinates.map((value) => value.toFixed(6)).join(", ")}
				</p>
			)}

			<CreateCheckpointForm
				key={editingCheckpoint?.id ?? route.id}
				checkpoint={editingCheckpoint}
				location={selectedLocation}
				expectedDurationMinutes={route.expectedDurationMinutes}
				disabled={createDisabled || mapMode !== "checkpoint"}
				isSubmitting={editingCheckpoint ? update.isSubmitting : create.isSubmitting}
				error={editingCheckpoint ? update.error : create.error}
				onSubmit={(payload) =>
					editingCheckpoint ? update.submit(editingCheckpoint.id, payload) : create.submit(payload)
				}
				onCreated={() => {
					setCheckpointNotice(editingCheckpoint ? "Đã cập nhật điểm dừng." : "Đã thêm điểm dừng.");
					setEditingCheckpoint(undefined);
					setSelectedLocation(undefined);
				}}
				onCancel={cancelCheckpointEdit}
			/>

			<CreateRouteDangerZoneForm
				mode={mapMode}
				geometry={dangerGeometry}
				polygonVertexCount={polygonVertices.length}
				disabled={createDisabled || Boolean(editingCheckpoint)}
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
				<h3 className="font-extrabold">Danh sách điểm dừng</h3>
				{checkpoints.isLoading && (
					<p className="mt-3 flex items-center gap-2 text-sm">
						<Loader2 className="size-4 animate-spin" /> Đang tải điểm dừng...
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
			<RouteSubmissionPanel
				route={route}
				checkpoints={checkpoints.items}
				isLoadingCheckpoints={checkpoints.isLoading}
				checkpointError={checkpoints.error}
				onReload={onRouteReload}
				onSubmitted={onRouteSubmitted}
			/>
		</section>
	);
}
