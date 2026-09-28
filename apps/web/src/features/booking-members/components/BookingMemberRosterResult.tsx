import { CheckCircle2 } from "lucide-react";
import type { InitializeBookingMembersResponse } from "../types";

export interface BookingMemberRosterResultProps {
	result: InitializeBookingMembersResponse;
	ownerId: string;
	labelsByUserId: ReadonlyMap<string, string>;
}

export function BookingMemberRosterResult({
	result,
	ownerId,
	labelsByUserId,
}: BookingMemberRosterResultProps) {
	return (
		<output
			aria-live="polite"
			className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
		>
			<div className="flex items-center gap-2 font-extrabold">
				<CheckCircle2 className="size-5" />
				Danh sách người tham gia đã được xác nhận
			</div>
			<p className="mt-1 text-xs">Mã đặt chỗ: {result.bookingId}</p>
			<p className="mt-1 text-xs">Tổng số người tham gia: {result.members.length}</p>
			<ul aria-label="Danh sách người tham gia đã xác nhận" className="mt-3 space-y-2">
				{result.members.map((member) => {
					const label =
						member.userId === ownerId
							? "Bạn"
							: member.userId
								? (labelsByUserId.get(member.userId) ?? "Người tham gia")
								: "Người tham gia";
					return (
						<li key={member.id} className="rounded-xl border border-emerald-200 bg-white px-3 py-2">
							<div className="flex items-center justify-between gap-3">
								<span className="font-bold">{label}</span>
								<span className="text-xs font-semibold">{member.memberStatus}</span>
							</div>
							{member.isPrimary && <p className="mt-1 text-xs font-bold">Người đặt chỗ chính</p>}
						</li>
					);
				})}
			</ul>
		</output>
	);
}
