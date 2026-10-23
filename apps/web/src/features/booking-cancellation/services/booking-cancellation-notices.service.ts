import { API_ENDPOINTS, httpClient } from "../../../core/api";

export interface BookingCancellationNotice {
	id: string;
	bookingId: string;
	tripId: string;
	tripTitle: string;
	camperName: string | null;
	reason: string;
	createdAt: string;
	readAt: string | null;
}

export const bookingCancellationNoticesService = {
	list: () =>
		httpClient.get<BookingCancellationNotice[]>(API_ENDPOINTS.BOOKINGS.CANCELLATION_NOTICES),
	markRead: (noticeId: string) =>
		httpClient.patch<void>(API_ENDPOINTS.BOOKINGS.READ_CANCELLATION_NOTICE(noticeId)),
};
