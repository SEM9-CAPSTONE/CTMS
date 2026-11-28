import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../../../core/api";
import {
	type BookingMembersWorkspace,
	type CreateBookingMemberInvitationResponse,
	type MyPendingBookingInvitation,
	type RespondBookingInvitationResponse,
	bookingInvitationsService,
} from "../services/booking-invitations.service";

export function localizeInvitationError(error: unknown): string {
	if (error instanceof HttpError) {
		const raw = error.message.toLowerCase();
		if (raw.includes("already included")) {
			return "Bạn là người đặt chỗ chính nên đã có sẵn trong danh sách tham gia.";
		}
		if (raw.includes("not active")) {
			return "Tài khoản này chưa được kích hoạt hoặc đang bị tạm khóa.";
		}
		if (raw.includes("already a member")) {
			return "Người này đã có trong danh sách thành viên của đơn đặt chỗ.";
		}
		if (raw.includes("already participating in this trip")) {
			return "Người này đã tham gia chuyến đi này ở một đơn đặt chỗ khác.";
		}
		if (raw.includes("active invitation already exists")) {
			return "Email này đã được gửi lời mời và đang chờ xác nhận.";
		}
		if (raw.includes("all booking slots") || raw.includes("capacity is already full")) {
			return "Tất cả các chỗ trong đơn đặt chỗ đã được phân bổ hoặc đang chờ xác nhận.";
		}
		if (raw.includes("already started") || raw.includes("expired")) {
			return "Chuyến đi đã bắt đầu hoặc lời mời đã hết hạn.";
		}
		if (raw.includes("different email")) {
			return "Lời mời này được gửi tới địa chỉ email khác với tài khoản bạn đang đăng nhập.";
		}
		if (raw.includes("primary booking owner cannot be removed")) {
			return "Không thể gỡ người đặt chỗ chính khỏi đơn.";
		}
		if (raw.includes("only registered companion members")) {
			return "Chỉ có thể gỡ thành viên đi cùng chưa điểm danh trước giờ khởi hành.";
		}
		if (raw.includes("only pending invitations")) {
			return "Lời mời này không còn ở trạng thái chờ xác nhận.";
		}
		if (raw.includes("not eligible")) {
			return "Đơn đặt chỗ hiện không còn đủ điều kiện cập nhật thành viên.";
		}
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
		if (error.status === 404) return "Không tìm thấy lời mời hoặc đơn đặt chỗ.";
		if (error.status === 422) return "Vui lòng nhập địa chỉ email hợp lệ.";
	}
	return "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại.";
}

export function useBookingMembersWorkspace(bookingId: string | null, enabled = true) {
	const [workspace, setWorkspace] = useState<BookingMembersWorkspace | null>(null);
	const [isLoading, setIsLoading] = useState(Boolean(bookingId && enabled));
	const [isMutating, setIsMutating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const reload = useCallback(async () => {
		if (!bookingId || !enabled) return;
		setIsLoading(true);
		setError(null);
		try {
			const data = await bookingInvitationsService.getWorkspace(bookingId);
			setWorkspace(data);
		} catch (err) {
			setError(localizeInvitationError(err));
		} finally {
			setIsLoading(false);
		}
	}, [bookingId, enabled]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const invite = useCallback(
		async (email: string): Promise<CreateBookingMemberInvitationResponse> => {
			if (!bookingId) throw new Error("Thiếu mã đơn đặt chỗ.");
			setIsMutating(true);
			try {
				const res = await bookingInvitationsService.createInvitation(bookingId, email);
				setWorkspace(res.workspace);
				return res;
			} finally {
				setIsMutating(false);
			}
		},
		[bookingId]
	);

	const revoke = useCallback(
		async (invitationId: string): Promise<BookingMembersWorkspace> => {
			if (!bookingId) throw new Error("Thiếu mã đơn đặt chỗ.");
			setIsMutating(true);
			try {
				const next = await bookingInvitationsService.revokeInvitation(bookingId, invitationId);
				setWorkspace(next);
				return next;
			} finally {
				setIsMutating(false);
			}
		},
		[bookingId]
	);

	const removeMember = useCallback(
		async (memberId: string): Promise<BookingMembersWorkspace> => {
			if (!bookingId) throw new Error("Thiếu mã đơn đặt chỗ.");
			setIsMutating(true);
			try {
				const next = await bookingInvitationsService.removeMember(bookingId, memberId);
				setWorkspace(next);
				return next;
			} finally {
				setIsMutating(false);
			}
		},
		[bookingId]
	);

	return {
		workspace,
		isLoading,
		isMutating,
		error,
		reload,
		invite,
		revoke,
		removeMember,
	};
}

export function useMyPendingInvitations(enabled = true) {
	const [invitations, setInvitations] = useState<MyPendingBookingInvitation[]>([]);
	const [isLoading, setIsLoading] = useState(enabled);
	const [respondingId, setRespondingId] = useState<string | null>(null);

	const reload = useCallback(async () => {
		if (!enabled) return;
		setIsLoading(true);
		try {
			const data = await bookingInvitationsService.listMyPending();
			setInvitations(data);
		} catch {
			setInvitations([]);
		} finally {
			setIsLoading(false);
		}
	}, [enabled]);

	useEffect(() => {
		void reload();
	}, [reload]);

	const accept = useCallback(
		async (invitation: MyPendingBookingInvitation): Promise<RespondBookingInvitationResponse> => {
			setRespondingId(invitation.id);
			try {
				const result = await bookingInvitationsService.accept(invitation.token);
				setInvitations((current) => current.filter((item) => item.id !== invitation.id));
				return result;
			} finally {
				setRespondingId(null);
			}
		},
		[]
	);

	const decline = useCallback(
		async (invitation: MyPendingBookingInvitation): Promise<RespondBookingInvitationResponse> => {
			setRespondingId(invitation.id);
			try {
				const result = await bookingInvitationsService.decline(invitation.token);
				setInvitations((current) => current.filter((item) => item.id !== invitation.id));
				return result;
			} finally {
				setRespondingId(null);
			}
		},
		[]
	);

	return {
		invitations,
		isLoading,
		respondingId,
		reload,
		accept,
		decline,
	};
}
