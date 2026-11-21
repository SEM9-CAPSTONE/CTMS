import { CheckCircle2, Compass, Info, Mail, Phone, Star, User } from "lucide-react";
import type { CamperProfileData } from "../../camper-profile/types";
import type { PorterProfile } from "../types";

interface PorterProfileHeaderProps {
	profile: PorterProfile | null;
	accountProfile?: CamperProfileData | null;
}

export function PorterProfileHeader({ profile, accountProfile }: PorterProfileHeaderProps) {
	const rating = profile ? Number(profile.ratingAvg).toFixed(1) : "0.0";
	const completedTrips = profile ? profile.completedTrips : 0;
	const isPersisted = profile && profile.version > 0;

	return (
		<section className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm sm:p-8">
			<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
				{/* Identity and Meta */}
				<div className="flex items-start gap-4">
					{accountProfile?.avatarUrl ? (
						<img
							src={accountProfile.avatarUrl}
							alt={accountProfile.fullName}
							className="size-16 shrink-0 rounded-2xl border border-[#dfe8df] object-cover shadow-xs"
						/>
					) : (
						<div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#e6f2f7] text-[#246b8e]">
							<User size={28} />
						</div>
					)}
					<div>
						<div className="flex items-center gap-2.5">
							<h1 className="text-2xl font-extrabold tracking-tight text-[#10221b] sm:text-3xl">
								{accountProfile?.fullName || "Hồ sơ người hỗ trợ"}
							</h1>
							<span data-testid="profile-persistence-badge" className="sr-only">
								{isPersisted ? (
									<>
										<CheckCircle2 size={12} />
										<span>Phiên bản v{profile.version}</span>
									</>
								) : (
									<>
										<Info size={12} />
										<span>Chưa lưu (Mặc định)</span>
									</>
								)}
							</span>
						</div>
						{accountProfile ? (
							<div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#53674d]">
								{accountProfile.email && (
									<span className="inline-flex items-center gap-1.5">
										<Mail size={13} className="text-[#667a6d]" />
										<span>{accountProfile.email}</span>
									</span>
								)}
								{accountProfile.phone && (
									<span className="inline-flex items-center gap-1.5">
										<Phone size={13} className="text-[#667a6d]" />
										<span>{accountProfile.phone}</span>
									</span>
								)}
							</div>
						) : (
							<p className="mt-1 text-sm text-[#627769]">
								Theo dõi cấp bậc, chứng chỉ chuyên môn và lịch sử dẫn đoàn.
							</p>
						)}
					</div>
				</div>

				{/* Read-only Authoritative Metrics */}
				<div className="flex flex-wrap items-center gap-3">
					<div
						data-testid="readonly-rating-card"
						className="flex items-center gap-3 rounded-2xl border border-[#e6eee6] bg-[#f9fbf9] px-4 py-3"
					>
						<div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
							<Star size={20} className="fill-amber-400 text-amber-500" />
						</div>
						<div>
							<p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7b8c82]">
								Đánh giá trung bình
							</p>
							<p className="text-lg font-black text-[#10221b]">
								{rating} <span className="text-xs font-bold text-[#8fa096]">/ 5.0</span>
							</p>
						</div>
					</div>

					<div
						data-testid="readonly-completed-trips-card"
						className="flex items-center gap-3 rounded-2xl border border-[#e6eee6] bg-[#f9fbf9] px-4 py-3"
					>
						<div className="flex size-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
							<Compass size={20} />
						</div>
						<div>
							<p className="text-[10px] font-extrabold uppercase tracking-wider text-[#7b8c82]">
								Chuyến đã hoàn thành
							</p>
							<p className="text-lg font-black text-[#10221b]">
								{completedTrips} <span className="text-xs font-bold text-[#8fa096]">chuyến</span>
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
