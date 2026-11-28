import {
	AlertTriangle,
	CalendarDays,
	CheckCircle2,
	Loader2,
	LogIn,
	MapPin,
	ShieldCheck,
	UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "../../../shared/components/Toast";
import type { StoredAuthUser } from "../../auth/utils/tokenStorage";
import { formatBookingDateTime } from "../../booking-details/utils/booking-details-formatters";
import { localizeInvitationError } from "../hooks/useBookingInvitations";
import {
	type PublicBookingInvitation,
	bookingInvitationsService,
} from "../services/booking-invitations.service";

export interface BookingInvitationPageProps {
	token: string;
	currentUser: StoredAuthUser | null;
	onNavigateToLogin: (redirectPath: string) => void;
	onNavigateToRegister: (email: string, redirectPath: string) => void;
	onNavigateToBookings: () => void;
	onNavigateToBookingDetails: (bookingId: string) => void;
	onNavigateHome: () => void;
	onLogout: () => void;
}

export function BookingInvitationPage({
	token,
	currentUser,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToBookings,
	onNavigateToBookingDetails,
	onNavigateHome,
	onLogout,
}: BookingInvitationPageProps) {
	const toast = useToast();
	const [invitation, setInvitation] = useState<PublicBookingInvitation | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const load = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			const data = await bookingInvitationsService.getPublicByToken(token);
			setInvitation(data);
		} catch (err) {
			setLoadError(localizeInvitationError(err));
		} finally {
			setIsLoading(false);
		}
	}, [token]);

	useEffect(() => {
		void load();
	}, [load]);

	const redirectPath = `/invitations/${token}`;
	const currentEmail = currentUser?.email?.trim().toLowerCase() ?? null;
	const invitedEmail = invitation?.invitedEmail.trim().toLowerCase() ?? null;
	const emailMatches = Boolean(currentEmail && invitedEmail && currentEmail === invitedEmail);

	async function handleAccept() {
		if (!invitation) return;
		setIsSubmitting(true);
		try {
			const res = await bookingInvitationsService.accept(token);
			toast.success("Bạn đã xác nhận tham gia chuyến đi thành công.");
			onNavigateToBookingDetails(res.bookingId);
		} catch (err) {
			toast.error(localizeInvitationError(err));
			void load();
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleDecline() {
		if (!invitation) return;
		setIsSubmitting(true);
		try {
			await bookingInvitationsService.decline(token);
			toast.success("Bạn đã từ chối lời mời tham gia chuyến đi.");
			await load();
		} catch (err) {
			toast.error(localizeInvitationError(err));
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isLoading) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-[#f4f7f2] p-6">
				<output className="flex items-center gap-3 rounded-3xl bg-white px-8 py-6 text-sm font-bold text-[#164027] shadow-sm">
					<Loader2 className="size-5 animate-spin" />
					<span>Đang tải thông tin lời mời...</span>
				</output>
			</main>
		);
	}

	if (loadError || !invitation) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-[#f4f7f2] p-6">
				<section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
					<AlertTriangle className="mx-auto size-10 text-rose-700" />
					<h1 className="mt-4 text-xl font-extrabold text-[#10221b]">
						Không thể mở lời mời tham gia
					</h1>
					<p className="mt-2 text-sm text-[#52665b]">
						{loadError ?? "Liên kết lời mời không tồn tại hoặc đã bị thu hồi."}
					</p>
					<button
						type="button"
						onClick={onNavigateHome}
						className="mt-6 rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f2e1c]"
					>
						Về trang chủ DiTrek
					</button>
				</section>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-[#f4f7f2] px-4 py-10 text-[#10221b]">
			<article className="w-full max-w-xl rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm sm:p-8">
				<p className="text-xs font-bold uppercase tracking-wider text-[#164027]">
					DiTrek · Lời mời tham gia chuyến đi
				</p>
				<h1 className="mt-2 text-2xl font-extrabold text-[#10221b]">{invitation.tripTitle}</h1>
				{invitation.routeName && (
					<p className="mt-1 flex items-center gap-1.5 text-sm text-[#52665b]">
						<MapPin className="size-4 text-[#164027]" />
						<span>{invitation.routeName}</span>
					</p>
				)}

				<dl className="mt-5 space-y-3 border-y border-[#edf3ed] py-4 text-sm">
					<div className="flex items-start justify-between gap-4">
						<dt className="text-[#667a6d]">Người mời</dt>
						<dd className="text-right font-bold">{invitation.inviterName}</dd>
					</div>
					<div className="flex items-start justify-between gap-4">
						<dt className="text-[#667a6d]">Email được mời</dt>
						<dd className="break-all text-right font-bold">{invitation.invitedEmail}</dd>
					</div>
					<div className="flex items-start justify-between gap-4">
						<dt className="flex items-center gap-1.5 text-[#667a6d]">
							<CalendarDays className="size-4 text-[#164027]" />
							<span>Lịch trình</span>
						</dt>
						<dd className="text-right font-bold">
							{formatBookingDateTime(invitation.tripStartsAt)} –{" "}
							{formatBookingDateTime(invitation.tripEndsAt)}
						</dd>
					</div>
				</dl>

				<div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-[#f4f7f2] p-4 text-xs leading-relaxed text-[#4f6356]">
					<ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#164027]" />
					<p>
						Để đảm bảo an toàn suốt hành trình (điểm danh, tải bản đồ ngoại tuyến, theo dõi GPS và
						cảnh báo lệch tuyến), mỗi thành viên cần có tài khoản DiTrek gắn đúng email được mời.
					</p>
				</div>

				{!invitation.canRespond ? (
					<div className="mt-6 space-y-4">
						<div className="flex items-center gap-2 rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4 text-sm font-semibold text-[#34483b]">
							<CheckCircle2 className="size-4 shrink-0 text-[#164027]" />
							<span>{invitation.unavailableReason ?? "Lời mời này không còn khả dụng."}</span>
						</div>
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								onClick={currentUser ? onNavigateToBookings : onNavigateHome}
								className="rounded-xl bg-[#164027] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f2e1c]"
							>
								{currentUser ? "Xem đơn đặt chỗ của tôi" : "Về trang chủ"}
							</button>
						</div>
					</div>
				) : !currentUser ? (
					<div className="mt-6 space-y-3">
						{!invitation.hasAccount ? (
							<>
								<button
									type="button"
									onClick={() => onNavigateToRegister(invitation.invitedEmail, redirectPath)}
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f2e1c]"
								>
									<UserPlus className="size-4" />
									<span>Đăng ký tài khoản DiTrek để chấp nhận lời mời</span>
								</button>
								<button
									type="button"
									onClick={() => onNavigateToLogin(redirectPath)}
									className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] bg-white px-5 py-2.5 text-sm font-bold text-[#164027] transition hover:bg-[#f4f7f2]"
								>
									<LogIn className="size-4" />
									<span>Tôi đã có tài khoản — Đăng nhập</span>
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									onClick={() => onNavigateToLogin(redirectPath)}
									className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f2e1c]"
								>
									<LogIn className="size-4" />
									<span>Đăng nhập DiTrek để chấp nhận lời mời</span>
								</button>
								<button
									type="button"
									onClick={() => onNavigateToRegister(invitation.invitedEmail, redirectPath)}
									className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] bg-white px-5 py-2.5 text-sm font-bold text-[#164027] transition hover:bg-[#f4f7f2]"
								>
									<UserPlus className="size-4" />
									<span>Đăng ký tài khoản mới</span>
								</button>
							</>
						)}
					</div>
				) : !emailMatches ? (
					<div className="mt-6 space-y-3">
						<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
							Bạn đang đăng nhập bằng <strong>{currentUser.email}</strong>, trong khi lời mời này
							dành cho <strong>{invitation.invitedEmail}</strong>. Hãy đăng xuất và đăng nhập đúng
							tài khoản để xác nhận.
						</div>
						<button
							type="button"
							onClick={onLogout}
							className="w-full rounded-xl border border-[#cbd9ce] bg-white px-5 py-2.5 text-sm font-bold text-[#164027] transition hover:bg-[#f4f7f2]"
						>
							Đăng xuất để đổi tài khoản
						</button>
					</div>
				) : (
					<div className="mt-6 flex flex-wrap justify-end gap-3">
						<button
							type="button"
							disabled={isSubmitting}
							onClick={() => void handleDecline()}
							className="rounded-xl border border-[#cbd9ce] bg-white px-5 py-2.5 text-sm font-bold text-[#4f6356] transition hover:bg-gray-50 disabled:opacity-50"
						>
							Từ chối
						</button>
						<button
							type="button"
							disabled={isSubmitting}
							onClick={() => void handleAccept()}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-50"
						>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							<span>Chấp nhận tham gia</span>
						</button>
					</div>
				)}
			</article>
		</main>
	);
}
