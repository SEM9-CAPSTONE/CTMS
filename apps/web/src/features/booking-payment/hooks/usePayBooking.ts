import { useCallback, useRef, useState } from "react";
import { bookingPaymentService } from "../services/booking-payment.service";
import type { BookingPaymentError, PayBookingRequest, PayBookingResponse } from "../types";
import { mapBookingPaymentError } from "./booking-payment-error";

interface ActiveAttempt {
	bookingId: string;
	fingerprint: string;
	input: PayBookingRequest;
	key: string;
}

function normalizeInput(input: PayBookingRequest): PayBookingRequest {
	return {
		method: input.method.trim(),
	};
}

function calculateFingerprint(bookingId: string, input: PayBookingRequest): string {
	return JSON.stringify({ bookingId, method: input.method });
}

export function usePayBooking() {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [result, setResult] = useState<PayBookingResponse | null>(null);
	const [error, setError] = useState<BookingPaymentError | null>(null);
	const inFlight = useRef(false);
	const activeAttempt = useRef<ActiveAttempt | null>(null);

	const execute = useCallback(async (attempt: ActiveAttempt) => {
		if (inFlight.current) return null;
		inFlight.current = true;
		setIsSubmitting(true);
		setError(null);

		try {
			const response = await bookingPaymentService.pay(
				attempt.bookingId,
				attempt.input,
				attempt.key
			);
			activeAttempt.current = null;
			setResult(response);
			return response;
		} catch (requestError) {
			setError(mapBookingPaymentError(requestError));
			return null;
		} finally {
			inFlight.current = false;
			setIsSubmitting(false);
		}
	}, []);

	const submit = useCallback(
		(bookingId: string, input: PayBookingRequest) => {
			if (inFlight.current) return Promise.resolve(null);
			const normalized = normalizeInput(input);
			const nextFingerprint = calculateFingerprint(bookingId, normalized);

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

	return {
		submit,
		retry,
		reset,
		isSubmitting,
		result,
		error,
	};
}
