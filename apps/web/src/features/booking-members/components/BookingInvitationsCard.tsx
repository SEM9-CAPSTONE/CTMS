import { Check, Copy, Loader2, MailPlus, Trash2, UserMinus, Users } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { useToast } from "../../../shared/components/Toast";
import { formatMemberStatus } from "../../booking-details/utils/booking-details-formatters";
import {
	localizeInvitationError,
	useBookingMembersWorkspace,
} from "../hooks/useBookingInvitations";
import { participantEmailSchema } from "../schema/initialize-booking-members.schema";
import type {
	BookingInvitationItem,
	BookingRosterMemberItem,
} from "../services/booking-invitations.service";

export interface BookingInvitationsCardProps {
	bookingId: string;
	compact?: boolean;
	onChanged?: () => void;
}

function buildAbsoluteInviteUrl(invitation: BookingInvitationItem): string {
	if (typeof window !== "undefined" && window.location?.origin) {
		return `${window.location.origin}${invitation.invitePath}`;
	}
	return invitation.inviteUrl ?? invitation.invitePath;
}

export function BookingInvitationsCard({
	bookingId,
	compact = false,
	onChanged,
}: BookingInvitationsCardProps) {
	const toast = useToast();
	const { workspace, isLoading, isMutating, error, reload, invite, revoke, removeMember } =
		useBookingMembersWorkspace(bookingId, true);

	const [email, setEmail] = useState("");
	const [emailError, setEmailError] = useState<string | null>(null);
	const [copiedId, setCopiedId] = useState<string | null>(null);
	const [revokeTarget, setRevokeTarget] = useState<BookingInvitationItem | null>(null);
	const [removeTarget, setRemoveTarget] = useState<BookingRosterMemberItem | null>(null);

	async function handleInviteSubmit(event: React.FormEvent) {
		event.preventDefault();
		const parsed = participantEmailSchema.safeParse(email);
		if (!parsed.success) {
			setEmailError(parsed.error.issues[0]?.message ?? "Vui lòng nhập email hợp lệ.");
			return;
		}
		setEmailError(null);
		try {
			const res = await invite(parsed.data);
			setEmail("");
			toast.success(
				res.emailSent
					? `Đã gửi lời mời tới ${res.invitation.invitedEmail}.`
					: `Đã tạo lời mời cho ${res.invitation.invitedEmail}. Bạn có thể sao chép liên kết mời để gửi trực tiếp.`
			);
			onChanged?.();
		} catch (err) {
			const message = localizeInvitationError(err);
			setEmailError(message);
			toast.error(message);
		}
	}

	async function handleCopyLink(invitation: BookingInvitationItem) {
		const url = buildAbsoluteInviteUrl(invitation);
		try {
			await navigator.clipboard.writeText(url);
			setCopiedId(invitation.id);
			toast.success("Đã sao chép liên kết mời tham gia.");
			window.setTimeout(() => {
				setCopiedId((current) => (current === invitation.id ? null : current));
			}, 2000);
		} catch {
			toast.error("Không thể sao chép tự động. Vui lòng sao chép thủ công.");
		}
	}

	async function handleConfirmRevoke() {
		if (!revokeTarget) return;
		try {
			await revoke(revokeTarget.id);
			toast.success(`Đã thu hồi lời mời tới ${revokeTarget.invitedEmail}.`);
			setRevokeTarget(null);
			onChanged?.();
		} catch (err) {
			toast.error(localizeInvitationError(err));
		}
	}

	async function handleConfirmRemove() {
		if (!removeTarget) return;
		try {
			await removeMember(removeTarget.id);
			toast.success("Đã gỡ thành viên khỏi đơn đặt chỗ.");
			setRemoveTarget(null);
			onChanged?.();
		} catch (err) {
			toast.error(localizeInvitationError(err));
		}
	}

	if (isLoading && !workspace) {
		return (
			<section className="rounded-3xl bg-white p-6 shadow-sm">
				<div className="flex items-center gap-2 text-sm text-[#52665b]">
					<Loader2 className="size-4 animate-spin text-[#164027]" />
					<span>Đang tải danh sách thành viên...</span>
				</div>
			</section>
		);
	}

	if (error && !workspace) {
		return (
			<section className="rounded-3xl bg-white p-6 shadow-sm">
				<p className="text-sm text-rose-700">{error}</p>
				<button
					type="button"
					onClick={() => void reload()}
					className="mt-3 rounded-xl border border-[#cbd9ce] px-3 py-1.5 text-xs font-semibold text-[#164027] hover:bg-[#f4f7f2]"
				>
					Thử lại
				</button>
			</section>
		);
	}

	if (!workspace) return null;

	return (
		<section
			aria-labelledby={`booking-members-workspace-${bookingId}`}
			className={
				compact
					? "rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4 text-xs shadow-2xs"
					: "rounded-3xl bg-white p-6 shadow-sm"
			}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2
					id={`booking-members-workspace-${bookingId}`}
					className={
						compact
							? "flex items-center gap-2 text-sm font-extrabold text-[#10221b]"
							: "flex items-center gap-2 text-lg font-extrabold text-[#10221b]"
					}
				>
					<Users className={compact ? "size-4 text-[#164027]" : "size-5 text-[#164027]"} />
					<span>Người tham gia</span>
				</h2>
				<div className="flex flex-wrap items-center gap-1.5">
					<span className="rounded-full bg-[#eef7f0] px-2.5 py-1 text-xs font-bold text-[#164027]">
						{workspace.activeMemberCount}/{workspace.numPeople} đã xác nhận
					</span>
					{workspace.pendingInvitationCount > 0 && (
						<span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
							{workspace.pendingInvitationCount} chờ chấp nhận
						</span>
					)}
				</div>
			</div>

			{workspace.remainingSlots > 0 && workspace.canManage && (
				<p className="mt-3 rounded-xl bg-[#f4f7f2] px-3.5 py-2.5 text-xs leading-relaxed text-[#4f6356]">
					Còn <strong>{workspace.remainingSlots} chỗ</strong> chưa gán người tham gia. Mọi thành
					viên cần có tài khoản DiTrek để điểm danh, tải bản đồ ngoại tuyến và theo dõi GPS an toàn.
				</p>
			)}

			<ul className="mt-4 space-y-2.5" aria-label="Danh sách người tham gia">
				{workspace.members.map((member) => {
					const displayName = member.fullName?.trim() || member.email || "Thành viên DiTrek";
					const canRemove =
						workspace.canManage && !member.isPrimary && member.memberStatus === "registered";
					return (
						<li
							key={member.id}
							className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dfe8df] bg-white px-4 py-3"
						>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-bold text-[#10221b]">{displayName}</p>
								{member.email && member.fullName?.trim() && (
									<p className="truncate text-xs text-[#667a6d]">{member.email}</p>
								)}
								<p className="mt-1 text-xs font-semibold text-[#164027]">
									{member.isPrimary ? "Người đặt chỗ chính" : "Thành viên đi cùng"}
								</p>
							</div>
							<div className="flex items-center gap-2">
								<span className="rounded-full bg-[#eef7f0] px-2.5 py-1 text-xs font-semibold text-[#164027]">
									{formatMemberStatus(member.memberStatus)}
								</span>
								{canRemove && (
									<button
										type="button"
										disabled={isMutating}
										onClick={() => setRemoveTarget(member)}
										aria-label={`Gỡ ${displayName}`}
										className="inline-flex items-center gap-1 rounded-xl border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
									>
										<UserMinus className="size-3.5" />
										<span>Gỡ</span>
									</button>
								)}
							</div>
						</li>
					);
				})}
			</ul>

			{workspace.invitations.length > 0 && (
				<div className="mt-4 space-y-2.5">
					<p className="text-xs font-bold uppercase tracking-wide text-[#52665b]">
						Lời mời đang chờ xác nhận
					</p>
					<ul className="space-y-2" aria-label="Lời mời đang chờ xác nhận">
						{workspace.invitations.map((invitation) => (
							<li
								key={invitation.id}
								className="rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3"
							>
								<div className="space-y-2.5">
									<div className="min-w-0">
										<p className="break-all text-sm font-bold text-[#10221b]">
											{invitation.invitedUserFullName?.trim() || invitation.invitedEmail}
										</p>
										{invitation.invitedUserFullName?.trim() && (
											<p className="break-all text-xs text-[#667a6d]">{invitation.invitedEmail}</p>
										)}
										<p className="mt-1 text-xs text-amber-900">
											{invitation.hasAccount
												? "Đã có tài khoản DiTrek · Đang chờ chấp nhận"
												: "Chưa có tài khoản · Cần đăng ký DiTrek qua liên kết mời"}
										</p>
									</div>
									{workspace.canManage && (
										<div className="flex flex-wrap items-center gap-2">
											<button
												type="button"
												onClick={() => void handleCopyLink(invitation)}
												className="inline-flex items-center gap-1 rounded-xl border border-[#cbd9ce] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#164027] transition hover:bg-[#f4f7f2]"
											>
												{copiedId === invitation.id ? (
													<>
														<Check className="size-3.5" />
														<span>Đã sao chép</span>
													</>
												) : (
													<>
														<Copy className="size-3.5" />
														<span>Sao chép link mời</span>
													</>
												)}
											</button>
											<button
												type="button"
												disabled={isMutating}
												onClick={() => setRevokeTarget(invitation)}
												className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
											>
												<Trash2 className="size-3.5" />
												<span>Thu hồi</span>
											</button>
										</div>
									)}
								</div>
							</li>
						))}
					</ul>
				</div>
			)}

			{workspace.canManage && workspace.remainingSlots > 0 && (
				<form onSubmit={(e) => void handleInviteSubmit(e)} className="mt-4 space-y-2">
					<label
						htmlFor={`invite-email-${bookingId}`}
						className="block text-xs font-bold text-[#34483b]"
					>
						Mời thành viên đi cùng qua email
					</label>
					<div className="flex flex-col gap-2 sm:flex-row">
						<input
							id={`invite-email-${bookingId}`}
							type="email"
							value={email}
							onChange={(event) => {
								setEmail(event.target.value);
								if (emailError) setEmailError(null);
							}}
							placeholder="nhap.email@example.com"
							disabled={isMutating}
							className="min-w-0 flex-1 rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none focus:ring-2 focus:ring-[#164027]/20"
						/>
						<button
							type="submit"
							disabled={isMutating || email.trim() === ""}
							className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isMutating ? (
								<Loader2 className="size-4 animate-spin" />
							) : (
								<MailPlus className="size-4" />
							)}
							<span>Gửi lời mời</span>
						</button>
					</div>
					{emailError && (
						<p role="alert" className="text-xs font-semibold text-rose-700">
							{emailError}
						</p>
					)}
				</form>
			)}

			<ConfirmModal
				isOpen={Boolean(revokeTarget)}
				onClose={() => setRevokeTarget(null)}
				onConfirm={() => void handleConfirmRevoke()}
				title="Thu hồi lời mời"
				description={
					revokeTarget
						? `Bạn có chắc muốn thu hồi lời mời đã gửi tới ${revokeTarget.invitedEmail}? Chỗ trống này sẽ mở lại để bạn mời người khác.`
						: ""
				}
				confirmText="Thu hồi lời mời"
				cancelText="Giữ nguyên"
				variant="danger"
				isLoading={isMutating}
			/>

			<ConfirmModal
				isOpen={Boolean(removeTarget)}
				onClose={() => setRemoveTarget(null)}
				onConfirm={() => void handleConfirmRemove()}
				title="Gỡ thành viên khỏi đơn"
				description={
					removeTarget
						? `Bạn có chắc muốn gỡ ${removeTarget.fullName?.trim() || removeTarget.email || "thành viên này"} khỏi đơn đặt chỗ? Sau khi gỡ, bạn có thể mời người khác thay thế trước giờ khởi hành.`
						: ""
				}
				confirmText="Gỡ thành viên"
				cancelText="Hủy"
				variant="danger"
				isLoading={isMutating}
			/>
		</section>
	);
}
