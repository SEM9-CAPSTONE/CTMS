import { useCallback, useRef, useState } from "react";
import { bookingMembersService } from "../services/booking-members.service";
import type {
	BookingMembersError,
	InitializeBookingMembersRequest,
	InitializeBookingMembersResponse,
} from "../types";
import { mapBookingMembersError } from "./booking-members-error";

interface ActiveAttempt {
	bookingId: string;
	fingerprint: string;
	input: InitializeBookingMembersRequest;
	key: string;
}

function normalizeInput(input: InitializeBookingMembersRequest): InitializeBookingMembersRequest {
	return {
		members: [...input.members].sort((left, right) => left.userId.localeCompare(right.userId)),
	};
}

function fingerprint(bookingId: string, input: InitializeBookingMembersRequest): string {
	return JSON.stringify({ bookingId, userIds: input.members.map((member) => member.userId) });
}

export function useInitializeBookingMembers() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<InitializeBookingMembersResponse | null>(null);
	const [error, setError] = useState<BookingMembersError | null>(null);
	const inFlight = useRef(false);
	const activeAttempt = useRef<ActiveAttempt | null>(null);

	const execute = useCallback(async (attempt: ActiveAttempt) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);
		try {
			const response = await bookingMembersService.initialize(
				attempt.bookingId,
				attempt.input,
				attempt.key
			);
			activeAttempt.current = null;
			setResult(response);
			return response;
		} catch (requestError) {
			setError(mapBookingMembersError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const submit = useCallback(
		(bookingId: string, input: InitializeBookingMembersRequest) => {
			if (inFlight.current) return Promise.resolve(null);
			const normalized = normalizeInput(input);
			const nextFingerprint = fingerprint(bookingId, normalized);
			if (activeAttempt.current?.fingerprint !== nextFingerprint) {
				activeAttempt.current = {
					bookingId,
					fingerprint: nextFingerprint,
					input: normalized,
					key: crypto.randomUUID(),
				};
			}
			return execute(activeAttempt.current);
		},
		[execute]
	);

	const retry = useCallback(
		() => (activeAttempt.current ? execute(activeAttempt.current) : Promise.resolve(null)),
		[execute]
	);

	const reset = useCallback(() => {
		activeAttempt.current = null;
		setResult(null);
		setError(null);
	}, []);

	return { submit, retry, reset, isSubmitting, result, error };
}
