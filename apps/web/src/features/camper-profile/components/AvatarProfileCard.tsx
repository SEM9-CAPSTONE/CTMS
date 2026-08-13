import { Calendar, Camera, CheckCircle2 } from "lucide-react";
import type { CamperProfileData } from "../types";

interface AvatarProfileCardProps {
	profile: CamperProfileData;
	onAvatarChange?: (newUrl: string) => void;
}

export function AvatarProfileCard({ profile, onAvatarChange }: AvatarProfileCardProps) {
	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const objectUrl = URL.createObjectURL(file);
		onAvatarChange?.(objectUrl);
	};

	return (
		<div className="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-[#e0ebe0] bg-gradient-to-r from-white via-[#f9fbf9] to-[#edf6ef] p-6 shadow-sm">
			{/* Avatar Image with Upload Icon */}
			<div className="relative group shrink-0">
				<img
					src={profile.avatarUrl}
					alt={profile.fullName}
					className="size-24 rounded-full object-cover ring-4 ring-white shadow-md"
				/>
				<label
					htmlFor="avatar-upload-input"
					className="absolute bottom-0 right-0 flex size-8 cursor-pointer items-center justify-center rounded-full bg-[#164027] text-white shadow-lg transition hover:bg-[#276143] hover:scale-105"
					title="Thay đổi ảnh đại diện"
				>
					<Camera size={15} />
				</label>
				<input
					id="avatar-upload-input"
					type="file"
					accept="image/*"
					onChange={handleFileSelect}
					className="hidden"
				/>
			</div>

			{/* User Info & Badges */}
			<div className="flex flex-col items-center sm:items-start text-center sm:text-left gap-2">
				<div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
					<h2 className="text-xl sm:text-2xl font-extrabold text-[#10221b] tracking-tight">
						{profile.fullName}
					</h2>
				</div>

				<p className="text-xs font-semibold text-[#5a6e61]">{profile.email}</p>

				<div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs font-semibold text-[#485c4f]">
					<div className="flex items-center gap-1.5">
						<Calendar size={14} className="text-[#164027]" />
						<span>Tham gia từ {profile.joinedYear}</span>
					</div>
					<div className="flex items-center gap-1.5">
						<CheckCircle2 size={14} className="text-emerald-600" />
						<span>Tài khoản đã xác minh</span>
					</div>
				</div>
			</div>
		</div>
	);
}
