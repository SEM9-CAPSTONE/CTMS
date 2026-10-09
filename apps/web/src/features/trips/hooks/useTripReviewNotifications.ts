import { useEffect } from "react";
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
	useEffect(() => {
		const socket = io(socketBaseUrl(), { transports: ["websocket"] });
		socket.on("trip.review.requested", (payload: TripReviewEvent) => {
			toast.info(`Trip "${payload.title}" vừa được gửi chờ duyệt.`, "Trip mới cần duyệt");
			onChanged?.();
		});
		socket.on("trip.review.reminder", (payload: TripReviewEvent) => {
			toast.warning(`Trip "${payload.title}" sắp quá hạn duyệt 24 giờ.`, "Nhắc duyệt Trip");
			onChanged?.();
		});
		return () => {
			socket.disconnect();
		};
	}, [onChanged]);
}

export function useHostTripReviewNotifications({
	onChanged,
}: UseTripReviewNotificationOptions = {}) {
	useEffect(() => {
		const socket = io(socketBaseUrl(), { transports: ["websocket"] });
		socket.on("trip.review.auto_rejected", (payload: TripReviewEvent) => {
			toast.warning(
				`Trip "${payload.title}" đã bị từ chối tự động vì quá 24 giờ chưa được duyệt.`,
				"Trip bị từ chối"
			);
			onChanged?.();
		});
		return () => {
			socket.disconnect();
		};
	}, [onChanged]);
}
