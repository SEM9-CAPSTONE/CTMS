import { useCallback, useRef, useState } from "react";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import type { CreateTrekkingRouteInput, CreatedTrekkingRoute } from "../types";
import { type CreateRouteError, mapCreateRouteError } from "./useCreateTrekkingRoute";

export function useDraftRouteWorkspace(initialRoute: CreatedTrekkingRoute) {
	const [route, setRoute] = useState(initialRoute);
	const [isEditing, setIsEditing] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateRouteError | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<CreateTrekkingRouteInput>();
	const submit = useCallback(
		async (payload: CreateTrekkingRouteInput) => {
			if (inFlight.current) return null;
			inFlight.current = true;
			lastPayload.current = payload;
			setIsSubmitting(true);
			setError(null);
			try {
				const updated = await trekkingRoutesService.updateDraft(initialRoute.id, payload);
				setRoute(updated);
				setIsEditing(false);
				return updated;
			} catch (requestError) {
				setError(mapCreateRouteError(requestError, "lưu"));
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[initialRoute.id]
	);
	const reload = useCallback(async () => {
		const routes = await trekkingRoutesService.listMine();
		const current = routes.find((item) => item.id === initialRoute.id);
		if (!current) throw new Error("Không tìm thấy tuyến đường đã lưu.");
		setRoute(current);
		return current;
	}, [initialRoute.id]);
	const retry = () => (lastPayload.current ? submit(lastPayload.current) : Promise.resolve(null));
	return { route, setRoute, isEditing, setIsEditing, isSubmitting, error, submit, reload, retry };
}
