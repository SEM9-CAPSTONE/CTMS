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
	const routeForm = (
		<CreateTrekkingRouteForm
			route={route}
			isSubmitting={workspace.isSubmitting}
			error={workspace.error}
			submitLabel="Bước tiếp theo"
			onSubmit={async (payload) => {
				const saved = await workspace.submit(payload);
				if (saved) {
					onRouteChanged?.(saved);
					setEditStep(2);
				}
			}}
			onRetry={async () => {
				const saved = await workspace.retry();
				if (saved) onRouteChanged?.(saved);
			}}
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
					routeForm
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
			{checkpointsPanel}
		</section>
	);
}
