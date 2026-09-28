import { useCallback, useRef, useState } from "react";
import { bookingMembersService } from "../services/booking-members.service";
import type { BookingMembersError } from "../types";
import { mapBookingMembersError } from "./booking-members-error";

export function useResolveBookingMemberCandidate() {
	const [isResolving, setIsResolving] = useState(false);
	const [error, setError] = useState<BookingMembersError | null>(null);
	const requestSequence = useRef(0);

	const resolve = useCallback(async (bookingId: string, email: string) => {
		const sequence = ++requestSequence.current;
		setIsResolving(true);
		setError(null);
		try {
			const result = await bookingMembersService.resolveCandidate(bookingId, { email });
			return sequence === requestSequence.current ? result : null;
		} catch (requestError) {
			if (sequence === requestSequence.current) setError(mapBookingMembersError(requestError));
			return null;
		} finally {
			if (sequence === requestSequence.current) setIsResolving(false);
		}
	}, []);

	const reset = useCallback(() => {
		requestSequence.current += 1;
		setIsResolving(false);
		setError(null);
	}, []);

	return { resolve, reset, isResolving, error };
}
