import { Calendar, Camera, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { uploadService } from "../../../core/services/upload.service";
import type { CamperProfileData } from "../types";

interface AvatarProfileCardProps {
	profile: CamperProfileData;
	onAvatarChange?: (newUrl: string) => void;
}

export function AvatarProfileCard({ profile, onAvatarChange }: AvatarProfileCardProps) {
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!file.type.startsWith("image/")) {
			setUploadError("Chỉ chấp nhận file hình ảnh");
			return;
		}

		if (file.size > 5 * 1024 * 1024) {
			setUploadError("Ảnh không được vượt quá 5 MB");
			return;
		}

		setUploadError(null);
		setIsUploading(true);
		try {
			const res = await uploadService.uploadImage(file, "avatars");
			onAvatarChange?.(res.url);
		} catch {
			setUploadError("Tải ảnh đại diện thất bại");
		} finally {
			setIsUploading(false);
			e.target.value = "";
		}
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
				{isUploading && (
					<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
						<Loader2 className="size-6 animate-spin text-white" />
					</div>
				)}
				<label
					htmlFor="avatar-upload-input"
					className={`absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-[#164027] text-white shadow-lg transition hover:bg-[#276143] hover:scale-105 ${
						isUploading ? "pointer-events-none opacity-50" : "cursor-pointer"
					}`}
					title="Thay đổi ảnh đại diện"
				>
					<Camera size={15} />
				</label>
				<input
					id="avatar-upload-input"
					type="file"
					accept="image/*"
					disabled={isUploading}
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
				{uploadError && <p className="text-xs font-bold text-red-600">{uploadError}</p>}

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
