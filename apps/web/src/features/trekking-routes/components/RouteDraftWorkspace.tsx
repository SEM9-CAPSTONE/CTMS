import { Pencil } from "lucide-react";
import { useState } from "react";
import { useDraftRouteWorkspace } from "../hooks/useDraftRouteWorkspace";
import type { CreatedTrekkingRoute } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";
import { RouteSafetyPreview } from "./RouteSafetyPreview";
import { RouteSubmissionPanel } from "./RouteSubmissionPanel";
import { statusLabels } from "./TrekkingRouteList";
interface Props {
	route: CreatedTrekkingRoute;
	onRouteChanged?: (route: CreatedTrekkingRoute) => void;
	mode?: "create" | "edit";
}
export function RouteDraftWorkspace({
	route: initialRoute,
	onRouteChanged,
	mode = "create",
}: Props) {
	const workspace = useDraftRouteWorkspace(initialRoute);
	const [editing, setEditing] = useState(mode === "edit" && initialRoute.status === "draft");
	const { route } = workspace;
	const acceptRoute = (updated: CreatedTrekkingRoute) => {
		workspace.setRoute(updated);
		onRouteChanged?.(updated);
	};
	const saved = (updated: CreatedTrekkingRoute | null) => {
		if (!updated) return;
		onRouteChanged?.(updated);
		setEditing(false);
	};
	return (
		<section
			aria-label={editing ? "Chỉnh sửa tuyến đường" : "Tuyến đường đã lưu"}
			className="grid gap-5"
		>
			{editing && route.status === "draft" ? (
				<CreateTrekkingRouteForm
					route={route}
					isSubmitting={workspace.isSubmitting}
					error={workspace.error}
					onSubmit={async (payload) => saved(await workspace.submit(payload))}
					onRetry={async () => saved(await workspace.retry())}
				/>
			) : (
				<>
					<output aria-label="Trạng thái tuyến" className="text-sm font-bold text-[#52675a]">
						{statusLabels[route.status]}
					</output>
					{route.status === "draft" && (
						<button
							type="button"
							onClick={() => setEditing(true)}
							className="flex w-fit items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"
						>
							<Pencil className="size-4" /> Chỉnh sửa tuyến
						</button>
					)}
					<RouteSafetyPreview geometry={route.geometry} routeId={route.id} />
					<RouteSubmissionPanel
						route={route}
						onReload={workspace.reload}
						onSubmitted={acceptRoute}
					/>
				</>
			)}
		</section>
	);
}
