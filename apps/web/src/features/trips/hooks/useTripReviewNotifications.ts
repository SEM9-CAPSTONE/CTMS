import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { toast } from "../../../shared/components";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

function socketBaseUrl(): string {
	return API_BASE_URL.replace(/\/api\/?$/, "");
}

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
}

export function useAdminTripReviewNotifications({
	onChanged,
}: UseTripReviewNotificationOptions = {}) {
	const changedRef = useRef(onChanged);
	useEffect(() => {
		changedRef.current = onChanged;
	}, [onChanged]);
	useEffect(() => {
		let socket: ReturnType<typeof io> | undefined;
		// StrictMode's discarded mount must not open a connection that is immediately closed.
		const timer = window.setTimeout(() => {
			socket = io(socketBaseUrl(), { transports: ["websocket"] });
			socket.on("connect", () => changedRef.current?.());
			socket.on("trip.review.updated", (payload: TripReviewEvent) => {
				toast.info(`Trip "${payload.title}" vừa được Host cập nhật.`, "Bản cập nhật chờ duyệt");
				changedRef.current?.();
			});
			socket.on("trip.review.requested", (payload: TripReviewEvent) => {
				toast.info(`Trip "${payload.title}" vừa được gửi chờ duyệt.`, "Trip mới cần duyệt");
				changedRef.current?.();
			});
			socket.on("trip.review.reminder", (payload: TripReviewEvent) => {
				toast.warning(`Trip "${payload.title}" sắp quá hạn duyệt 24 giờ.`, "Nhắc duyệt Trip");
				changedRef.current?.();
			});
		}, 0);
		return () => {
			window.clearTimeout(timer);
			socket?.disconnect();
		};
	}, []);
}

export function useHostTripReviewNotifications({
	onChanged,
}: UseTripReviewNotificationOptions = {}) {
	const changedRef = useRef(onChanged);
	useEffect(() => {
		changedRef.current = onChanged;
	}, [onChanged]);
	useEffect(() => {
		let socket: ReturnType<typeof io> | undefined;
		// StrictMode's discarded mount must not open a connection that is immediately closed.
		const timer = window.setTimeout(() => {
			socket = io(socketBaseUrl(), { transports: ["websocket"] });
			socket.on("trip.review.auto_rejected", (payload: TripReviewEvent) => {
				toast.warning(
					`Trip "${payload.title}" đã bị từ chối tự động vì quá 24 giờ chưa được duyệt.`,
					"Trip bị từ chối"
				);
				changedRef.current?.();
			});
		}, 0);
		return () => {
			window.clearTimeout(timer);
			socket?.disconnect();
		};
	}, []);
}
