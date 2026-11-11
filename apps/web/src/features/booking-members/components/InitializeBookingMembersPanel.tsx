import { AlertCircle, Loader2, RefreshCw, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { BookTripResponse } from "../../trips/types";
import { localizeBookingMembersMessage } from "../hooks/booking-members-error";
import { useInitializeBookingMembers } from "../hooks/useInitializeBookingMembers";
import { useResolveBookingMemberCandidate } from "../hooks/useResolveBookingMemberCandidate";
import {
	participantEmailSchema,
	validateResolvedParticipants,
} from "../schema/initialize-booking-members.schema";
import type {
	InitializeBookingMembersResponse,
	ResolveBookingMemberCandidateResponse,
} from "../types";
import { BookingMemberRosterResult } from "./BookingMemberRosterResult";
import { ParticipantEmailRow } from "./ParticipantEmailRow";

export interface InitializeBookingMembersPanelProps {
	booking: BookTripResponse;
	confirmedRoster?: InitializeBookingMembersResponse | null;
	confirmedLabelsByUserId?: ReadonlyMap<string, string>;
	defaultOpen?: boolean;
}

export function InitializeBookingMembersPanel({
	booking,
	confirmedRoster = null,
	confirmedLabelsByUserId = new Map(),
	defaultOpen = false,
}: InitializeBookingMembersPanelProps) {
	const requiredCount = Math.max(0, booking.numPeople - 1);
	const [rowIds] = useState(() => Array.from({ length: requiredCount }, () => crypto.randomUUID()));
	const [emails, setEmails] = useState(() => Array.from({ length: requiredCount }, () => ""));
	const [candidates, setCandidates] = useState<Array<ResolveBookingMemberCandidateResponse | null>>(
		() => Array.from({ length: requiredCount }, () => null)
	);
	const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
	const [isModalOpen, setIsModalOpen] = useState(defaultOpen);

	const resolver = useResolveBookingMemberCandidate();
	const initializer = useInitializeBookingMembers();
	const resolved = candidates.filter(
		(candidate): candidate is ResolveBookingMemberCandidateResponse => candidate !== null
	);
	const labelsByUserId = useMemo(
		() => new Map(resolved.map((candidate) => [candidate.userId, candidate.email])),
		[resolved]
	);
	const isEligibleStatus = booking.status === "pending_payment" || booking.status === "confirmed";
	const hasStarted = new Date(booking.tripStartsAtSnapshot) <= new Date();

	const displayedRoster = initializer.result ?? confirmedRoster;

	if (!isEligibleStatus || hasStarted) {
		return (
			<section
				role="alert"
				className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
			>
				Không thể cập nhật người tham gia vì đặt chỗ không còn đủ điều kiện hoặc chuyến đi đã bắt
				đầu.
			</section>
		);
	}

	async function resolveSlot(index: number) {
		const parsed = participantEmailSchema.safeParse(emails[index]);
		if (!parsed.success) {
			setFieldErrors((current) => ({
				...current,
				[index]: parsed.error.issues[0]?.message ?? "Email không hợp lệ",
			}));
			return;
		}
		const normalizedEmail = parsed.data.toLowerCase();
		if (resolved.some((candidate) => candidate.email === normalizedEmail)) {
			setFieldErrors((current) => ({ ...current, [index]: "Email này đã được chọn" }));
			return;
		}
		const candidate = await resolver.resolve(booking.id, normalizedEmail);
		if (!candidate) return;
		if (candidate.userId === booking.userId) {
			setFieldErrors((current) => ({
				...current,
				[index]: "Người đặt chỗ được hệ thống tự động thêm",
			}));
			return;
		}
		if (resolved.some((item) => item.userId === candidate.userId)) {
			setFieldErrors((current) => ({ ...current, [index]: "Người này đã được chọn" }));
			return;
		}
		setEmails((current) =>
			current.map((value, position) => (position === index ? candidate.email : value))
		);
		setCandidates((current) =>
			current.map((value, position) => (position === index ? candidate : value))
		);
		setFieldErrors((current) => {
			const next = { ...current };
			delete next[index];
			return next;
		});
		setFormError(null);
	}

	function changeEmail(index: number, value: string) {
		setEmails((current) => current.map((email, position) => (position === index ? value : email)));
		setCandidates((current) =>
			current.map((candidate, position) => (position === index ? null : candidate))
		);
		setFieldErrors((current) => {
			const next = { ...current };
			delete next[index];
			return next;
		});
		setFormError(null);
		resolver.reset();
	}

	async function submitRoster() {
		const validationError = validateResolvedParticipants(resolved, requiredCount, booking.userId);
		if (validationError) {
			setFormError(validationError);
			return;
		}
		setFormError(null);
		await initializer.submit(booking.id, {
			members: resolved.map((candidate) => ({ userId: candidate.userId })),
		});
	}

	const rawError = formError ?? resolver.error?.message ?? initializer.error?.message ?? null;
	const displayedError = rawError
		? localizeBookingMembersMessage(
				rawError,
				resolver.error?.status ?? initializer.error?.status ?? 0
			)
		: null;

	return (
		<>
			{/* Compact Sidebar Summary Card */}
			<section
				aria-labelledby="booking-members-title"
				className="rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4 text-xs shadow-2xs"
			>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Users className="size-4 text-[#164027]" />
						<h3 id="booking-members-title" className="text-sm font-extrabold text-[#10221b]">
							Danh sách người tham gia
						</h3>
					</div>
					<span
						className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
							displayedRoster
								? "bg-emerald-100 text-emerald-800"
								: requiredCount === 0 || resolved.length === requiredCount
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-100 text-amber-800"
						}`}
					>
						{displayedRoster
							? `Đã xác nhận (${displayedRoster.members.length} người)`
							: requiredCount === 0
								? "1 người"
								: `Đã xác nhận (${resolved.length}/${requiredCount})`}
					</span>
				</div>

				<p className="mt-2 text-xs text-[#52665b]">
					{displayedRoster
						? "Danh sách thành viên chuyến đi đã được lưu đầy đủ."
						: requiredCount === 0
							? "Bạn là người tham gia duy nhất cho đặt chỗ này."
							: `Cần xác nhận email cho ${requiredCount} người tham gia còn lại.`}
				</p>

				<button
					type="button"
					onClick={() => setIsModalOpen(true)}
					className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#164027] py-2.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
				>
					<Users className="size-4" />
					<span>
						{displayedRoster ? "Xem danh sách người tham gia" : "Xác nhận danh sách người tham gia"}
					</span>
				</button>
			</section>

			{/* Modal Dialog Pop-up */}
			{isModalOpen && (
				<div
					data-testid="booking-members-modal-backdrop"
					className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/60 p-4 backdrop-blur-xs"
					onClick={(e) => {
						if (e.target === e.currentTarget && !initializer.isSubmitting) {
							setIsModalOpen(false);
						}
					}}
				>
					<dialog
						open
						aria-labelledby="booking-members-dialog-title"
						className="relative m-0 flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-[#dfe8df] bg-white p-0 text-[#10221b] shadow-2xl"
					>
						{/* Modal Header */}
						<header className="flex items-center justify-between border-b border-[#dfe8df] px-6 py-4">
							<div className="flex items-center gap-2">
								<Users className="size-5 text-[#164027]" />
								<h2
									id="booking-members-dialog-title"
									className="text-base font-extrabold text-[#10221b]"
								>
									Xác nhận người tham gia
								</h2>
							</div>
							<button
								type="button"
								aria-label="Đóng cửa sổ"
								disabled={initializer.isSubmitting}
								onClick={() => setIsModalOpen(false)}
								className="rounded-xl p-1.5 text-[#667a6d] transition hover:bg-gray-100 hover:text-[#10221b] disabled:opacity-50"
							>
								<X className="size-5" />
							</button>
						</header>

						{/* Modal Body */}
						<div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
							{displayedRoster ? (
								<BookingMemberRosterResult
									result={displayedRoster}
									ownerId={booking.userId}
									labelsByUserId={initializer.result ? labelsByUserId : confirmedLabelsByUserId}
								/>
							) : (
								<>
									<div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
										<div>
											<p className="font-bold text-[#10221b]">Bạn — Người đặt chỗ chính</p>
											<p className="text-[11px] text-emerald-700">
												Người tham gia chính · hệ thống tự động thêm
											</p>
										</div>
										<span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
											Tự động thêm
										</span>
									</div>

									{requiredCount === 0 ? (
										<div className="rounded-xl bg-[#f8faf7] p-3 text-[#52665b]">
											Đặt chỗ này không cần thêm người tham gia.
										</div>
									) : (
										<>
											<p className="text-[#52665b]">
												Tổng: {booking.numPeople} · Đã xác nhận thêm: {resolved.length} · Còn lại:{" "}
												{requiredCount - resolved.length}
											</p>

											<div className="space-y-3">
												{emails.map((email, index) => (
													<ParticipantEmailRow
														key={rowIds[index]}
														index={index}
														email={email}
														candidate={candidates[index]}
														error={fieldErrors[index]}
														isResolving={resolver.isResolving}
														onEmailChange={(value) => changeEmail(index, value)}
														onResolve={() => void resolveSlot(index)}
														onRemove={() => changeEmail(index, "")}
													/>
												))}
											</div>
										</>
									)}

									{displayedError && (
										<div
											role="alert"
											className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800"
										>
											<AlertCircle className="size-4 shrink-0" />
											<span>{displayedError}</span>
										</div>
									)}

									{(resolver.isResolving || initializer.isSubmitting) && (
										<output
											aria-live="polite"
											className="flex items-center gap-2 font-bold text-[#52665b]"
										>
											<Loader2 className="size-4 animate-spin text-[#164027]" />
											<span>Đang xử lý danh sách người tham gia...</span>
										</output>
									)}
								</>
							)}
						</div>

						{/* Modal Footer */}
						<footer className="flex items-center justify-end gap-2 border-t border-[#dfe8df] bg-[#f9fbf9] px-6 py-4 rounded-b-3xl">
							<button
								type="button"
								onClick={() => setIsModalOpen(false)}
								disabled={initializer.isSubmitting}
								className="rounded-xl border border-[#cbd9ce] bg-white px-4 py-2 text-xs font-bold text-[#4f6356] transition hover:bg-gray-100 disabled:opacity-50"
							>
								Đóng
							</button>
							{!displayedRoster && (
								<>
									<button
										type="button"
										onClick={() => void submitRoster()}
										disabled={
											initializer.isSubmitting ||
											resolver.isResolving ||
											resolved.length !== requiredCount
										}
										className="rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-60 disabled:cursor-not-allowed"
									>
										{initializer.isSubmitting
											? "Đang xác nhận..."
											: requiredCount === 0
												? "Xác nhận người tham gia"
												: "Xác nhận danh sách"}
									</button>
									{initializer.error?.canRetry && (
										<button
											type="button"
											onClick={() => void initializer.retry()}
											className="inline-flex items-center gap-1 rounded-xl border border-[#b9cbbb] bg-white px-4 py-2 text-xs font-bold transition hover:bg-gray-100"
										>
											<RefreshCw className="size-3.5" />
											<span>Thử lại</span>
										</button>
									)}
								</>
							)}
						</footer>
					</dialog>
				</div>
			)}
		</>
	);
}
