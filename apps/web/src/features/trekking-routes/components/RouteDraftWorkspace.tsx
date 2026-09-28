import { useDraftRouteWorkspace } from "../hooks/useDraftRouteWorkspace";
import type { CreatedTrekkingRoute, RouteCheckpoint, RouteDangerZone } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";
import { RouteCheckpointsPanel } from "./RouteCheckpointsPanel";

interface Props {
	route: CreatedTrekkingRoute;
	onCheckpointsChange?: (items: RouteCheckpoint[]) => void;
	onDangerZonesChange?: (items: RouteDangerZone[]) => void;
	onRouteChanged?: (route: CreatedTrekkingRoute) => void;
}

export function RouteDraftWorkspace({
	route: initialRoute,
	onCheckpointsChange,
	onDangerZonesChange,
	onRouteChanged,
}: Props) {
	const workspace = useDraftRouteWorkspace(initialRoute);
	const { route } = workspace;
	const acceptRoute = (updated: CreatedTrekkingRoute) => {
		workspace.setRoute(updated);
		onRouteChanged?.(updated);
	};
	return (
		<section aria-label="Hoàn thiện tuyến đường" className="mt-6 grid gap-5">
			<div className="rounded-2xl border bg-white p-5">
				<h2 className="font-extrabold">{route.name}</h2>
				<p>
					Trạng thái: <span data-testid="server-route-status">{route.status}</span>
				</p>
				<p>
					Chiều dài đã lưu:{" "}
					<span data-testid="server-route-length">{route.lengthMeters.toFixed(1)} m</span>
				</p>
				{route.status === "draft" && !workspace.isEditing && (
					<button
						type="button"
						className="mt-3 rounded-xl border px-4 py-2 font-bold"
						onClick={() => workspace.setIsEditing(true)}
					>
						Chỉnh sửa tuyến nháp
					</button>
				)}
			</div>
			{workspace.isEditing && route.status === "draft" ? (
				<CreateTrekkingRouteForm
					route={route}
					isSubmitting={workspace.isSubmitting}
					error={workspace.error}
					onSubmit={async (payload) => {
						const saved = await workspace.submit(payload);
						if (saved) onRouteChanged?.(saved);
					}}
					onRetry={async () => {
						const saved = await workspace.retry();
						if (saved) onRouteChanged?.(saved);
					}}
					onCancel={() => workspace.setIsEditing(false)}
				/>
			) : (
				<RouteCheckpointsPanel
					key={`${route.id}:${route.updatedAt}`}
					route={route}
					onRouteReload={workspace.reload}
					onRouteSubmitted={acceptRoute}
					onCheckpointsChange={onCheckpointsChange}
					onDangerZonesChange={onDangerZonesChange}
				/>
			)}
		</section>
	);
}
