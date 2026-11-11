import { Check, Loader2, Search, X } from "lucide-react";
import { useId } from "react";
import type { ResolveBookingMemberCandidateResponse } from "../types";

export interface ParticipantEmailRowProps {
	index: number;
	email: string;
	candidate: ResolveBookingMemberCandidateResponse | null;
	error?: string;
	isResolving: boolean;
	onEmailChange: (value: string) => void;
	onResolve: () => void;
	onRemove: () => void;
}

export function ParticipantEmailRow({
	index,
	email,
	candidate,
	error,
	isResolving,
	onEmailChange,
	onResolve,
	onRemove,
}: ParticipantEmailRowProps) {
	const inputId = useId();
	const errorId = `${inputId}-error`;
	return (
		<div className="rounded-xl border border-[#dfe8df] bg-white p-3">
			<label htmlFor={inputId} className="text-xs font-bold text-[#34483b]">
				Email người tham gia {index + 1}
			</label>
			<div className="mt-1 flex flex-col gap-2 sm:flex-row">
				<input
					id={inputId}
					type="email"
					value={email}
					onChange={(event) => onEmailChange(event.target.value)}
					disabled={isResolving}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
					className="min-w-0 flex-1 rounded-xl border border-[#cbd9ce] px-3 py-2 text-sm focus:border-[#164027] focus:outline-none focus:ring-2 focus:ring-[#164027]/20"
				/>
				{candidate ? (
					<button
						type="button"
						onClick={onRemove}
						className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
					>
						<X className="size-4" /> Thay đổi
					</button>
				) : (
					<button
						type="button"
						onClick={onResolve}
						disabled={isResolving || email.trim() === ""}
						className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#164027] px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#164027]/40 disabled:opacity-60"
					>
						{isResolving ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Search className="size-4" />
						)}
						{isResolving ? "Đang kiểm tra..." : "Xác nhận email"}
					</button>
				)}
			</div>
			{candidate && (
				<p className="mt-2 flex items-center gap-1 text-xs font-bold text-emerald-700">
					<Check className="size-4" /> Đã xác nhận: {candidate.email}
				</p>
			)}
			{error && (
				<p id={errorId} role="alert" className="mt-2 text-xs font-semibold text-red-700">
					{error}
				</p>
			)}
		</div>
	);
}
