import { useDraftRouteWorkspace } from "../hooks/useDraftRouteWorkspace";
import { routeEditorMessages } from "../route-editor-messages";
import { type CreatedTrekkingRoute, ROUTE_SAVE_INTENTS, ROUTE_STATUSES } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";
import { statusLabels } from "./TrekkingRouteList";
interface Props {
	route?: CreatedTrekkingRoute;
	onRouteChanged?: (route: CreatedTrekkingRoute) => void;
	onSubmitted?: (route: CreatedTrekkingRoute) => void;
}
export function RouteDraftWorkspace({ route: initialRoute, onRouteChanged, onSubmitted }: Props) {
	const workspace = useDraftRouteWorkspace(initialRoute);
	const { route } = workspace;
	const acceptRoute = (updated: CreatedTrekkingRoute | null) => {
		if (!updated) return;
		onRouteChanged?.(updated);
		if (updated.status !== ROUTE_STATUSES.DRAFT) onSubmitted?.(updated);
	};
	return (
		<section aria-label={routeEditorMessages.vi.editorLabel} className="grid gap-5">
			{route && route.status !== ROUTE_STATUSES.DRAFT ? (
				<output aria-label="Trạng thái tuyến" className="text-sm font-bold text-[#52675a]">
					{statusLabels[route.status]}
				</output>
			) : (
				<>
					<CreateTrekkingRouteForm
						route={route}
						isSubmitting={workspace.isSubmitting}
						isSendingForApproval={workspace.isSendingForApproval}
						error={workspace.error}
						onSubmit={async (payload) => acceptRoute(await workspace.submit(payload))}
						onSubmitForApproval={async (payload) =>
							acceptRoute(await workspace.submit(payload, ROUTE_SAVE_INTENTS.SUBMIT))
						}
					/>
					{workspace.saved && (
						<output className="text-sm font-medium text-[#164027]">
							{routeEditorMessages.vi.saved}
						</output>
					)}
				</>
			)}
		</section>
	);
}
