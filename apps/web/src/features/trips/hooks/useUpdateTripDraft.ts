import { useCallback, useRef, useState } from "react";
import { tripsService } from "../services/trips.service";
import type { CreateTripInput, Trip } from "../types";
import { type CreateTripError, mapCreateTripError } from "./useCreateTrip";

export function useUpdateTripDraft(tripId: string | undefined) {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<CreateTripError | null>(null);
	const [updatedTrip, setUpdatedTrip] = useState<Trip | null>(null);
	const inFlight = useRef(false);
	const lastPayload = useRef<CreateTripInput | null>(null);

	const execute = useCallback(
		async (payload: CreateTripInput) => {
			if (!tripId || inFlight.current) return null;
			inFlight.current = true;
			setIsSubmitting(true);
			setError(null);
			try {
				const updated = await tripsService.updateDraft(tripId, payload);
				setUpdatedTrip(updated);
				return updated;
			} catch (requestError) {
				setError(mapCreateTripError(requestError));
				return null;
			} finally {
				inFlight.current = false;
				setIsSubmitting(false);
			}
		},
		[tripId]
	);

	const submit = useCallback(
		(payload: CreateTripInput) => {
			lastPayload.current = payload;
			return execute(payload);
		},
		[execute]
	);

	const retry = useCallback(
		() => (lastPayload.current ? execute(lastPayload.current) : Promise.resolve(null)),
		[execute]
	);

	const reset = useCallback(() => {
		setUpdatedTrip(null);
		setError(null);
		lastPayload.current = null;
	}, []);

	return { isSubmitting, error, updatedTrip, submit, retry, reset };
}
