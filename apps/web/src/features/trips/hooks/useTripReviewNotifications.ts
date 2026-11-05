import { type MutableRefObject, useEffect, useRef } from "react";
import type {
	RealtimeConnection,
	RealtimeConnectionState,
} from "../../../core/realtime/realtimeConnection";
import { useRealtimeConnection, useRealtimeEvent } from "../../../core/realtime/useRealtime";
import { toast } from "../../../shared/components";

interface TripReviewEvent {
	tripId: string;
	title: string;
	hostId: string;
	submittedAt?: string;
	updatedAt?: string;
	deadlineAt?: string;
	rejectedAt?: string;
	reason?: string;
}

interface UseTripReviewNotificationOptions {
	onChanged?: () => void;
	connection?: RealtimeConnection;
}

/**
 * Calls `onChanged` after every authenticated (re)connect so events missed while offline are
 * recovered from the API, and returns the shared connection state (CTMS-078-T02).
 */
function useReviewChannel(
	onChanged: (() => void) | undefined,
	connection: RealtimeConnection | undefined
): { changedRef: MutableRefObject<(() => void) | undefined>; state: RealtimeConnectionState } {
	const changedRef = useRef(onChanged);
	useEffect(() => {
		changedRef.current = onChanged;
	}, [onChanged]);
	const snapshot = useRealtimeConnection(true, connection);
	useEffect(() => {
		if (snapshot.state === "connected") changedRef.current?.();
	}, [snapshot.state]);
	return { changedRef, state: snapshot.state };
}

/** CTMS-023 review queue events, delivered only to `role:admin` sockets since CTMS-078. */
export function useAdminTripReviewNotifications({
	onChanged,
	connection,
}: UseTripReviewNotificationOptions = {}): RealtimeConnectionState {
	const { changedRef, state } = useReviewChannel(onChanged, connection);
	useRealtimeEvent<TripReviewEvent>(
		"trip.review.updated",
		(payload) => {
			toast.info(`Trip "${payload.title}" vừa được Host cập nhật.`, "Bản cập nhật chờ duyệt");
			changedRef.current?.();
		},
		true,
		connection
	);
	useRealtimeEvent<TripReviewEvent>(
		"trip.review.requested",
		(payload) => {
			toast.info(`Trip "${payload.title}" vừa được gửi chờ duyệt.`, "Trip mới cần duyệt");
			changedRef.current?.();
		},
		true,
		connection
	);
	useRealtimeEvent<TripReviewEvent>(
		"trip.review.reminder",
		(payload) => {
			toast.warning(`Trip "${payload.title}" sắp quá hạn duyệt 24 giờ.`, "Nhắc duyệt Trip");
			changedRef.current?.();
		},
		true,
		connection
	);
	return state;
}

/** CTMS-023 auto-rejection, delivered only to the owning Host's user room since CTMS-078. */
export function useHostTripReviewNotifications({
	onChanged,
	connection,
}: UseTripReviewNotificationOptions = {}): RealtimeConnectionState {
	const { changedRef, state } = useReviewChannel(onChanged, connection);
	useRealtimeEvent<TripReviewEvent>(
		"trip.review.auto_rejected",
		(payload) => {
			toast.warning(
				`Trip "${payload.title}" đã bị từ chối tự động vì quá 24 giờ chưa được duyệt.`,
				"Trip bị từ chối"
			);
			changedRef.current?.();
		},
		true,
		connection
	);
	return state;
}
