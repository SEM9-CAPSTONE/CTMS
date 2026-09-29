import { AlertCircle, Loader2, RefreshCw, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { BookTripResponse } from "../../trips/types";
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
}

export function InitializeBookingMembersPanel({
	booking,
	confirmedRoster = null,
	confirmedLabelsByUserId = new Map(),
}: InitializeBookingMembersPanelProps) {
	const requiredCount = Math.max(0, booking.numPeople - 1);
	const [rowIds] = useState(() => Array.from({ length: requiredCount }, () => crypto.randomUUID()));
	const [emails, setEmails] = useState(() => Array.from({ length: requiredCount }, () => ""));
	const [candidates, setCandidates] = useState<Array<ResolveBookingMemberCandidateResponse | null>>(
		() => Array.from({ length: requiredCount }, () => null)
	);
	const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
	const [formError, setFormError] = useState<string | null>(null);
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
	if (displayedRoster) {
		return (
			<BookingMemberRosterResult
				result={displayedRoster}
				ownerId={booking.userId}
				labelsByUserId={initializer.result ? labelsByUserId : confirmedLabelsByUserId}
			/>
		);
	}

	if (!isEligibleStatus || hasStarted) {
		return (
			<section
				role="alert"
				className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900"
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

	const displayedError = formError ?? resolver.error?.message ?? initializer.error?.message ?? null;
	return (
		<section
			aria-labelledby="booking-members-title"
			className="mt-4 rounded-2xl border border-[#dfe8df] bg-[#f8faf7] p-4"
		>
			<h3
				id="booking-members-title"
				className="flex items-center gap-2 text-sm font-extrabold text-[#10221b]"
			>
				<Users className="size-5 text-[#164027]" /> Xác nhận người tham gia
			</h3>
			<div className="mt-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs">
				<p className="font-bold">Bạn — Người đặt chỗ chính</p>
				<p className="mt-1 text-emerald-700">Người tham gia chính · hệ thống tự động thêm</p>
			</div>
			<p className="mt-3 text-xs text-[#52665b]">
				Tổng: {booking.numPeople} · Đã xác nhận thêm: {resolved.length} · Còn lại:{" "}
				{requiredCount - resolved.length}
			</p>

			{requiredCount === 0 ? (
				<p className="mt-3 text-xs text-[#52665b]">Đặt chỗ này không cần thêm người tham gia.</p>
			) : (
				<div className="mt-3 space-y-3">
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
			)}

			{displayedError && (
				<div
					role="alert"
					className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
				>
					<AlertCircle className="size-4 shrink-0" /> <span>{displayedError}</span>
				</div>
			)}
			{(resolver.isResolving || initializer.isSubmitting) && (
				<output
					aria-live="polite"
					className="mt-3 flex items-center gap-2 text-xs font-bold text-[#52665b]"
				>
					<Loader2 className="size-4 animate-spin" /> Đang xử lý danh sách người tham gia...
				</output>
			)}
			<div className="mt-4 flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => void submitRoster()}
					disabled={
						initializer.isSubmitting || resolver.isResolving || resolved.length !== requiredCount
					}
					className="rounded-xl bg-[#164027] px-4 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#164027]/40 disabled:opacity-60"
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
						className="inline-flex items-center gap-1 rounded-xl border border-[#b9cbbb] px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#164027]/30"
					>
						<RefreshCw className="size-4" /> Thử lại
					</button>
				)}
			</div>
		</section>
	);
}
