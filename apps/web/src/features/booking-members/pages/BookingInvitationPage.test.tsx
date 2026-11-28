import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../shared/components/Toast";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import {
	type PublicBookingInvitation,
	bookingInvitationsService,
} from "../services/booking-invitations.service";
import { BookingInvitationPage } from "./BookingInvitationPage";

const sampleInvitation: PublicBookingInvitation = {
	id: "inv-1",
	bookingId: "booking-1",
	tripId: "trip-1",
	tripTitle: "Khám phá bán đảo Sơn Trà",
	routeName: "Tuyến Sơn Trà",
	tripStartsAt: "2029-09-05T01:00:00.000Z",
	tripEndsAt: "2029-09-05T10:00:00.000Z",
	inviterName: "Nguyễn Minh Anh",
	invitedEmail: "ban@ditrek.vn",
	hasAccount: false,
	status: "pending",
	canRespond: true,
	unavailableReason: null,
	expiresAt: "2029-09-05T01:00:00.000Z",
};

describe("BookingInvitationPage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(bookingInvitationsService, "getPublicByToken").mockResolvedValue(sampleInvitation);
	});

	it("prompts unregistered invitee to register a DiTrek account with prefilled email", async () => {
		const onRegister = vi.fn();
		render(
			<ToastProvider>
				<BookingInvitationPage
					token="tok-1"
					currentUser={null}
					onNavigateToLogin={vi.fn()}
					onNavigateToRegister={onRegister}
					onNavigateToBookings={vi.fn()}
					onNavigateToBookingDetails={vi.fn()}
					onNavigateHome={vi.fn()}
					onLogout={vi.fn()}
				/>
			</ToastProvider>
		);

		expect(await screen.findByText("Khám phá bán đảo Sơn Trà")).toBeVisible();
		fireEvent.click(
			screen.getByRole("button", { name: "Đăng ký tài khoản DiTrek để chấp nhận lời mời" })
		);
		expect(onRegister).toHaveBeenCalledWith("ban@ditrek.vn", "/invitations/tok-1");
	});

	it("lets signed-in invited camper accept and redirects to booking details", async () => {
		const acceptSpy = vi.spyOn(bookingInvitationsService, "accept").mockResolvedValue({
			id: "inv-1",
			bookingId: "booking-1",
			tripId: "trip-1",
			status: "accepted",
		});
		const onDetails = vi.fn();
		const signedInUser = {
			id: "user-2",
			email: "ban@ditrek.vn",
			role: "camper",
		} as StoredAuthUser;

		render(
			<ToastProvider>
				<BookingInvitationPage
					token="tok-1"
					currentUser={signedInUser}
					onNavigateToLogin={vi.fn()}
					onNavigateToRegister={vi.fn()}
					onNavigateToBookings={vi.fn()}
					onNavigateToBookingDetails={onDetails}
					onNavigateHome={vi.fn()}
					onLogout={vi.fn()}
				/>
			</ToastProvider>
		);

		fireEvent.click(await screen.findByRole("button", { name: "Chấp nhận tham gia" }));
		await waitFor(() => {
			expect(acceptSpy).toHaveBeenCalledWith("tok-1");
			expect(onDetails).toHaveBeenCalledWith("booking-1");
		});
	});
});
