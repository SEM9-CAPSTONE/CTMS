import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../shared/components/Toast";
import {
	type BookingMembersWorkspace,
	bookingInvitationsService,
} from "../services/booking-invitations.service";
import { BookingInvitationsCard } from "./BookingInvitationsCard";

const baseWorkspace: BookingMembersWorkspace = {
	bookingId: "booking-1",
	numPeople: 2,
	activeMemberCount: 1,
	pendingInvitationCount: 0,
	remainingSlots: 1,
	canManage: true,
	members: [
		{
			id: "member-owner",
			userId: "owner-1",
			email: "owner@ditrek.vn",
			fullName: "Nguyễn Minh Anh",
			isPrimary: true,
			memberStatus: "registered",
			createdAt: "2029-09-01T00:00:00.000Z",
		},
	],
	invitations: [],
};

describe("BookingInvitationsCard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("renders active member count and invites a companion by email", async () => {
		vi.spyOn(bookingInvitationsService, "getWorkspace").mockResolvedValue(baseWorkspace);
		const createSpy = vi.spyOn(bookingInvitationsService, "createInvitation").mockResolvedValue({
			invitation: {
				id: "inv-1",
				bookingId: "booking-1",
				invitedEmail: "ban@ditrek.vn",
				invitedUserFullName: null,
				hasAccount: false,
				status: "pending",
				token: "tok-abc",
				invitePath: "/invitations/tok-abc",
				inviteUrl: null,
				expiresAt: "2029-09-05T00:00:00.000Z",
				respondedAt: null,
				createdAt: "2029-09-01T01:00:00.000Z",
			},
			emailSent: false,
			workspace: {
				...baseWorkspace,
				pendingInvitationCount: 1,
				remainingSlots: 0,
				invitations: [
					{
						id: "inv-1",
						bookingId: "booking-1",
						invitedEmail: "ban@ditrek.vn",
						invitedUserFullName: null,
						hasAccount: false,
						status: "pending",
						token: "tok-abc",
						invitePath: "/invitations/tok-abc",
						inviteUrl: null,
						expiresAt: "2029-09-05T00:00:00.000Z",
						respondedAt: null,
						createdAt: "2029-09-01T01:00:00.000Z",
					},
				],
			},
		});

		render(
			<ToastProvider>
				<BookingInvitationsCard bookingId="booking-1" />
			</ToastProvider>
		);

		expect(await screen.findByText("Nguyễn Minh Anh")).toBeVisible();
		expect(screen.getByText("1/2 đã xác nhận")).toBeVisible();

		fireEvent.change(screen.getByLabelText("Mời thành viên đi cùng qua email"), {
			target: { value: "ban@ditrek.vn" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Gửi lời mời" }));

		await waitFor(() => {
			expect(createSpy).toHaveBeenCalledWith("booking-1", "ban@ditrek.vn");
		});
		expect(await screen.findByText("ban@ditrek.vn")).toBeVisible();
		expect(screen.getByRole("button", { name: "Sao chép link mời" })).toBeVisible();
	});
});
