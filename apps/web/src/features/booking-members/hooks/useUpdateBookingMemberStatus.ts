import { useCallback, useRef, useState } from "react";
import { bookingMembersService } from "../services/booking-members.service";
import type {
	MemberStatusError,
	UpdateBookingMemberStatusRequest,
	UpdateBookingMemberStatusResponse,
} from "../types";
import { mapMemberStatusError } from "./member-status-error";

interface StatusAttempt {
	tripId: string;
	bookingId: string;
	memberId: string;
	input: UpdateBookingMemberStatusRequest;
}

type UpdateMemberStatus = typeof bookingMembersService.updateStatus;
const updateMemberStatusFromService: UpdateMemberStatus = (...args) =>
	bookingMembersService.updateStatus(...args);

export interface MemberStatusMutationResult {
	response: UpdateBookingMemberStatusResponse | null;
	error: MemberStatusError | null;
}

export function useUpdateBookingMemberStatus(
	refetchRoster: () => Promise<unknown>,
	updateMemberStatus: UpdateMemberStatus = updateMemberStatusFromService
) {
	const pendingRef = useRef(new Set<string>());
	const retryRef = useRef(new Map<string, StatusAttempt>());
	const [pendingMemberIds, setPendingMemberIds] = useState<ReadonlySet<string>>(new Set());
	const [errors, setErrors] = useState<Record<string, MemberStatusError>>({});
	const [accessRevoked, setAccessRevoked] = useState(false);

	const execute = useCallback(
		async (attempt: StatusAttempt): Promise<MemberStatusMutationResult> => {
			if (pendingRef.current.has(attempt.memberId)) return { response: null, error: null };
			pendingRef.current.add(attempt.memberId);
			setPendingMemberIds(new Set(pendingRef.current));
			setErrors((current) => {
				const next = { ...current };
				delete next[attempt.memberId];
				return next;
			});

			try {
				const response = await updateMemberStatus(
					attempt.tripId,
					attempt.bookingId,
					attempt.memberId,
					attempt.input
				);
				retryRef.current.delete(attempt.memberId);
				await refetchRoster();
				return { response, error: null };
			} catch (requestError) {
				const error = mapMemberStatusError(requestError);
				if (error.canRetry) retryRef.current.set(attempt.memberId, attempt);
				else retryRef.current.delete(attempt.memberId);
				if (error.kind === "forbidden" || error.kind === "unauthenticated") setAccessRevoked(true);
				setErrors((current) => ({ ...current, [attempt.memberId]: error }));
				if (error.kind === "conflict" || error.kind === "not_found" || error.kind === "retryable") {
					await refetchRoster();
				}
				return { response: null, error };
			} finally {
				pendingRef.current.delete(attempt.memberId);
				setPendingMemberIds(new Set(pendingRef.current));
			}
		},
		[refetchRoster, updateMemberStatus]
	);

	const updateStatus = useCallback(
		(
			tripId: string,
			bookingId: string,
			memberId: string,
			status: UpdateBookingMemberStatusRequest["status"]
		) => execute({ tripId, bookingId, memberId, input: { status } }),
		[execute]
	);

	const retry = useCallback(
		async (memberId: string) => {
			const attempt = retryRef.current.get(memberId);
			if (!attempt) return { response: null, error: null };
			await refetchRoster();
			return execute(attempt);
		},
		[execute, refetchRoster]
	);

	return { updateStatus, retry, pendingMemberIds, errors, accessRevoked };
}
