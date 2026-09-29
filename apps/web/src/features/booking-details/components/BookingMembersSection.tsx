import { Users } from "lucide-react";
import type { BookingDetailsMember } from "../types";
import { formatMemberStatus } from "../utils/booking-details-formatters";

export function BookingMembersSection({ members }: { members: BookingDetailsMember[] }) {
	return (
		<section
			aria-labelledby="booking-members-heading"
			className="rounded-3xl bg-white p-6 shadow-sm"
		>
			<h2 id="booking-members-heading" className="flex items-center gap-2 text-lg font-extrabold">
				<Users className="size-5 text-[#164027]" /> Người tham gia
			</h2>
			{members.length === 0 ? (
				<p className="mt-4 text-sm text-[#667a6d]">Chưa có thông tin người tham gia.</p>
			) : (
				<ul className="mt-4 space-y-3" aria-label="Danh sách người tham gia">
					{members.map((member) => (
						<li key={member.id} className="rounded-2xl border border-[#dfe8df] p-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="break-all font-bold text-[#10221b]">
									{member.email ?? "Không có email hiển thị"}
								</p>
								<span className="rounded-full bg-[#eef7f0] px-3 py-1 text-xs font-bold text-[#164027]">
									{formatMemberStatus(member.memberStatus)}
								</span>
							</div>
							{member.isPrimary && (
								<p className="mt-2 text-xs font-bold text-emerald-700">Người đặt chỗ chính</p>
							)}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
