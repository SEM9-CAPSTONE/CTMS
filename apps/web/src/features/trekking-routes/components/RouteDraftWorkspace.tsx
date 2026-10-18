import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useDraftRouteWorkspace } from "../hooks/useDraftRouteWorkspace";
import type { CreatedTrekkingRoute, RouteCheckpoint, RouteDangerZone } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";
import { RouteCheckpointsPanel } from "./RouteCheckpointsPanel";

interface Props {
	route: CreatedTrekkingRoute;
	onCheckpointsChange?: (items: RouteCheckpoint[]) => void;
	onDangerZonesChange?: (items: RouteDangerZone[]) => void;
	onRouteChanged?: (route: CreatedTrekkingRoute) => void;
	/** "edit" shows the route form first, then "Bước tiếp theo" moves on to picking locations. */
	mode?: "create" | "edit";
}

export function RouteDraftWorkspace({
	route: initialRoute,
	onCheckpointsChange,
	onDangerZonesChange,
	onRouteChanged,
	mode = "create",
}: Props) {
	const workspace = useDraftRouteWorkspace(initialRoute);
	const [editStep, setEditStep] = useState<1 | 2>(initialRoute.status === "draft" ? 1 : 2);
	const { route } = workspace;
	const acceptRoute = (updated: CreatedTrekkingRoute) => {
		workspace.setRoute(updated);
		onRouteChanged?.(updated);
	};
	const routeForm = (onCancel?: () => void, onSaved?: () => void, submitLabel?: string) => (
		<CreateTrekkingRouteForm
			route={route}
			isSubmitting={workspace.isSubmitting}
			error={workspace.error}
			submitLabel={submitLabel}
			onSubmit={async (payload) => {
				const saved = await workspace.submit(payload);
				if (saved) {
					onRouteChanged?.(saved);
					onSaved?.();
				}
			}}
			onRetry={async () => {
				const saved = await workspace.retry();
				if (saved) onRouteChanged?.(saved);
			}}
			onCancel={onCancel}
		/>
	);
	const checkpointsPanel = (
		<RouteCheckpointsPanel
			key={`${route.id}:${route.updatedAt}`}
			route={route}
			onRouteReload={workspace.reload}
			onRouteSubmitted={acceptRoute}
			onCheckpointsChange={onCheckpointsChange}
			onDangerZonesChange={onDangerZonesChange}
		/>
	);

	if (mode === "edit") {
		return (
			<section aria-label="Chỉnh sửa tuyến đường" className="grid gap-5">
				{editStep === 1 && route.status === "draft" ? (
					routeForm(undefined, () => setEditStep(2), "Bước tiếp theo")
				) : (
					<>
						{route.status === "draft" && (
							<button
								type="button"
								onClick={() => setEditStep(1)}
								className="flex w-fit items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
							>
								<ArrowLeft className="size-4" />
								Quay lại thông tin tuyến
							</button>
						)}
						{checkpointsPanel}
					</>
				)}
			</section>
		);
	}

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
			{workspace.isEditing && route.status === "draft"
				? routeForm(() => workspace.setIsEditing(false))
				: checkpointsPanel}
		</section>
	);
}
