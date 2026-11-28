import { CalendarDays, Check, Loader2, Mail, X } from "lucide-react";
import { useToast } from "../../../shared/components/Toast";
import { formatBookingDateTime } from "../../booking-details/utils/booking-details-formatters";
import { localizeInvitationError, useMyPendingInvitations } from "../hooks/useBookingInvitations";
import type { MyPendingBookingInvitation } from "../services/booking-invitations.service";

export interface MyPendingInvitationsSectionProps {
	onAccepted?: (bookingId: string) => void;
}

export function MyPendingInvitationsSection({ onAccepted }: MyPendingInvitationsSectionProps) {
	const toast = useToast();
	const { invitations, isLoading, respondingId, accept, decline } = useMyPendingInvitations(true);

	if (isLoading || invitations.length === 0) return null;

	async function handleAccept(invitation: MyPendingBookingInvitation) {
		try {
			const res = await accept(invitation);
			toast.success(`Bạn đã tham gia chuyến đi "${invitation.tripTitle}".`);
			onAccepted?.(res.bookingId);
		} catch (err) {
			toast.error(localizeInvitationError(err));
		}
	}

	async function handleDecline(invitation: MyPendingBookingInvitation) {
		try {
			await decline(invitation);
			toast.success("Đã từ chối lời mời tham gia chuyến đi.");
		} catch (err) {
			toast.error(localizeInvitationError(err));
		}
	}

	return (
		<section
			aria-labelledby="pending-booking-invitations-heading"
			className="mt-4 rounded-2xl border border-[#c7dccb] bg-white p-5 shadow-xs"
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Mail className="size-4 text-[#164027]" />
					<h2
						id="pending-booking-invitations-heading"
						className="text-base font-extrabold text-[#10221b]"
					>
						Lời mời tham gia chuyến đi ({invitations.length})
					</h2>
				</div>
			</div>
			<p className="mt-1 text-xs text-[#52665b]">
				Xác nhận tham gia để mở đầy đủ điểm danh, bản đồ ngoại tuyến và theo dõi GPS an toàn.
			</p>

			<ul className="mt-3 space-y-3">
				{invitations.map((invitation) => {
					const isBusy = respondingId === invitation.id;
					return (
						<li
							key={invitation.id}
							className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4"
						>
							<div className="min-w-0 flex-1">
								<p className="text-sm font-extrabold text-[#10221b]">{invitation.tripTitle}</p>
								{invitation.routeName && (
									<p className="text-xs text-[#667a6d]">{invitation.routeName}</p>
								)}
								<p className="mt-1 flex items-center gap-1.5 text-xs text-[#4f6356]">
									<CalendarDays className="size-3.5 shrink-0 text-[#164027]" />
									<span>
										{formatBookingDateTime(invitation.tripStartsAt)} –{" "}
										{formatBookingDateTime(invitation.tripEndsAt)}
									</span>
								</p>
								<p className="mt-1 text-xs text-[#52665b]">
									Người mời: <strong>{invitation.inviterName}</strong>
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									disabled={isBusy}
									onClick={() => void handleDecline(invitation)}
									className="inline-flex items-center gap-1 rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-xs font-bold text-[#4f6356] transition hover:bg-gray-50 disabled:opacity-50"
								>
									<X className="size-3.5" />
									<span>Từ chối</span>
								</button>
								<button
									type="button"
									disabled={isBusy}
									onClick={() => void handleAccept(invitation)}
									className="inline-flex items-center gap-1 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-50"
								>
									{isBusy ? (
										<Loader2 className="size-3.5 animate-spin" />
									) : (
										<Check className="size-3.5" />
									)}
									<span>Chấp nhận tham gia</span>
								</button>
							</div>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
