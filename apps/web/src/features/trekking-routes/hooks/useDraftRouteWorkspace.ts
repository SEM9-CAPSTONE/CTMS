import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { trekkingRoutesService } from "../services/trekking-routes.service";
import {
	type CreateTrekkingRouteInput,
	type CreatedTrekkingRoute,
	ROUTE_SAVE_INTENTS,
	ROUTE_STATUSES,
	type RouteSaveIntent,
	type SaveRouteRequest,
} from "../types";
import { type CreateRouteError, mapCreateRouteError } from "./useCreateTrekkingRoute";
import { mapRouteSubmissionError } from "./useSubmitRouteForApproval";

export function useDraftRouteWorkspace(initialRoute?: CreatedTrekkingRoute) {
	const queryClient = useQueryClient();
	const savedRoute = useRef(initialRoute);
	const savedPayload = useRef<string>();
	const inFlight = useRef(false);
	const mutation = useMutation<CreatedTrekkingRoute, CreateRouteError, SaveRouteRequest>({
		retry: false,
		mutationFn: async ({ payload, intent }) => {
			const fingerprint = JSON.stringify(payload);
			if (!savedRoute.current || savedPayload.current !== fingerprint) {
				try {
					savedRoute.current = savedRoute.current
						? await trekkingRoutesService.updateDraft(savedRoute.current.id, payload)
						: await trekkingRoutesService.create(payload);
					savedPayload.current = fingerprint;
				} catch (error) {
					throw mapCreateRouteError(error, "lưu");
				}
			}
			const route = savedRoute.current;
			if (intent === ROUTE_SAVE_INTENTS.SAVE || route.status !== ROUTE_STATUSES.DRAFT) return route;
			try {
				const submitted = await trekkingRoutesService.submitForApproval(route.id);
				savedRoute.current = submitted;
				return submitted;
			} catch (error) {
				const mapped = mapRouteSubmissionError(error);
				// Reconcile a potentially successful request whose response was lost.
				if (!mapped.status || mapped.status === 409 || mapped.status >= 500) {
					try {
						const latest = await trekkingRoutesService.getMineById(route.id);
						if (latest.status !== ROUTE_STATUSES.DRAFT) {
							savedRoute.current = latest;
							return latest;
						}
					} catch {
						// Retain the saved draft if the status check also fails.
					}
				}
				throw {
					...mapped,
					canRetry: !mapped.status || mapped.status === 409 || mapped.status >= 500,
				} satisfies CreateRouteError;
			}
		},
		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.trekking.all });
		},
	});

	async function submit(
		payload: CreateTrekkingRouteInput,
		intent: RouteSaveIntent = ROUTE_SAVE_INTENTS.SAVE
	) {
		if (inFlight.current) return null;
		inFlight.current = true;
		try {
			return await mutation.mutateAsync({ payload, intent });
		} catch {
			return null;
		} finally {
			inFlight.current = false;
		}
	}
	return {
		route: savedRoute.current,
		isSubmitting: mutation.isPending,
		isSendingForApproval:
			mutation.isPending && mutation.variables?.intent === ROUTE_SAVE_INTENTS.SUBMIT,
		error: mutation.error,
		saved: mutation.isSuccess && mutation.data.status === ROUTE_STATUSES.DRAFT,
		submit,
	};
}
