import { Camera, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { API_ENDPOINTS, httpClient } from "../../../core/api";
import { uploadService } from "../../../core/services/upload.service";
import { Button, Modal } from "../../../shared/components";
import { toast } from "../../../shared/components/Toast";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData, ProfileApiResponse } from "../../camper-profile/types";
import type { PorterProfileFormValues } from "../schema/porter-profile.schema";
import { PorterProfileForm } from "./PorterProfileForm";

interface PorterAccountEditModalProps {
	isOpen: boolean;
	onClose: () => void;
	accountProfile: CamperProfileData | null;
	onAccountUpdated: (updated: CamperProfileData) => void;
	porterForm: UseFormReturn<PorterProfileFormValues>;
	isPorterSaving: boolean;
	isPorterDirty: boolean;
	onPorterSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
	onPorterReset: () => void;
}

function toApiDate(value: string): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
	if (match) {
		return `${match[3]}-${match[2]}-${match[1]}`;
	}
	return trimmed;
}

const INPUT_CLASS =
	"w-full rounded-xl border border-[#d2ded2] bg-white px-3.5 py-2.5 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-1 focus:ring-[#164027] disabled:bg-[#f4f7f2] disabled:text-[#667a6d]";

export function PorterAccountEditModal({
	isOpen,
	onClose,
	accountProfile,
	onAccountUpdated,
	porterForm,
	isPorterSaving,
	isPorterDirty,
	onPorterSubmit,
	onPorterReset,
}: PorterAccountEditModalProps) {
	const [activeTab, setActiveTab] = useState<"personal" | "professional">("personal");
	const [fullName, setFullName] = useState("");
	const [phone, setPhone] = useState("");
	const [dateOfBirth, setDateOfBirth] = useState("");
	const [gender, setGender] = useState<"male" | "female" | "other">("male");
	const [address, setAddress] = useState("");
	const [bio, setBio] = useState("");
	const [avatarUrl, setAvatarUrl] = useState("");
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [isSavingPersonal, setIsSavingPersonal] = useState(false);

	useEffect(() => {
		if (isOpen && accountProfile) {
			setFullName(accountProfile.fullName ?? "");
			setPhone(accountProfile.phone ?? "");
			setDateOfBirth(accountProfile.dateOfBirth ?? "");
			setGender(accountProfile.gender ?? "male");
			setAddress(accountProfile.address ?? "");
			setBio(accountProfile.bio ?? "");
			setAvatarUrl(accountProfile.avatarUrl ?? "");
		}
	}, [isOpen, accountProfile]);

	const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			toast.error("Vui lòng chọn tệp hình ảnh hợp lệ.");
			return;
		}
		if (file.size > 5 * 1024 * 1024) {
			toast.error("Ảnh đại diện không được vượt quá 5 MB.");
			return;
		}
		setIsUploadingAvatar(true);
		try {
			const res = await uploadService.uploadImage(file, "avatars");
			const nextUrl = await camperProfileService.updateAvatar(res.url, accountProfile?.id);
			setAvatarUrl(nextUrl);
			if (accountProfile) {
				onAccountUpdated({ ...accountProfile, avatarUrl: nextUrl });
			}
			toast.success("Đã cập nhật ảnh đại diện.");
		} catch {
			toast.error("Không thể tải lên ảnh đại diện. Vui lòng thử lại.");
		} finally {
			setIsUploadingAvatar(false);
			e.target.value = "";
		}
	};

	const handleSavePersonal = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!fullName.trim()) {
			toast.error("Vui lòng nhập họ và tên.");
			return;
		}
		setIsSavingPersonal(true);
		try {
			await httpClient.patch<ProfileApiResponse>(API_ENDPOINTS.PROFILE.ME, {
				fullName: fullName.trim(),
				phone: phone.trim(),
				dateOfBirth: toApiDate(dateOfBirth),
				gender,
				address: address.trim(),
				bio: bio.trim(),
				avatarUrl: avatarUrl || undefined,
			});
			const refreshed = await camperProfileService.getProfile();
			onAccountUpdated(refreshed);
			toast.success("Đã cập nhật thông tin cá nhân.");
			onClose();
		} catch {
			toast.error("Không thể lưu thông tin cá nhân. Vui lòng kiểm tra lại.");
		} finally {
			setIsSavingPersonal(false);
		}
	};

	const isBusy = isSavingPersonal || isUploadingAvatar || isPorterSaving;

	return (
		<Modal
			isOpen={isOpen}
			onClose={() => {
				onPorterReset();
				onClose();
			}}
			isCloseDisabled={isBusy}
			title="Chỉnh sửa hồ sơ"
			size="lg"
		>
			<div className="space-y-5">
				{/* 2-tab pill switcher */}
				<div
					role="tablist"
					aria-label="Mục chỉnh sửa hồ sơ"
					className="inline-flex rounded-xl border border-[#dfe8df] bg-[#f8faf7] p-1"
				>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "personal"}
						onClick={() => setActiveTab("personal")}
						className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "personal" ? "bg-[#164027] text-white" : "text-[#4a5e51] hover:bg-white"
						}`}
					>
						Thông tin cá nhân
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={activeTab === "professional"}
						onClick={() => setActiveTab("professional")}
						className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
							activeTab === "professional"
								? "bg-[#164027] text-white"
								: "text-[#4a5e51] hover:bg-white"
						}`}
					>
						Hồ sơ chuyên môn
					</button>
				</div>

				{activeTab === "personal" ? (
					<form onSubmit={handleSavePersonal} className="space-y-4">
						{/* Avatar row */}
						<div className="flex items-center gap-4 rounded-xl bg-[#f8faf7] p-4">
							<div className="relative shrink-0">
								<img
									src={avatarUrl || accountProfile?.avatarUrl || ""}
									alt={fullName || "Ảnh đại diện"}
									className="size-18 rounded-full border-2 border-white object-cover shadow-xs"
								/>
								{isUploadingAvatar && (
									<div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
										<Loader2 className="size-5 animate-spin text-white" />
									</div>
								)}
								<label
									htmlFor="porter-avatar-upload"
									className="absolute bottom-0 right-0 flex size-7 cursor-pointer items-center justify-center rounded-full bg-[#164027] text-white shadow-xs transition hover:bg-[#10221b]"
									title="Đổi ảnh đại diện"
								>
									<Camera size={13} />
								</label>
								<input
									id="porter-avatar-upload"
									type="file"
									accept="image/*"
									disabled={isUploadingAvatar}
									onChange={handleAvatarFileChange}
									className="hidden"
								/>
							</div>
							<div className="min-w-0">
								<p className="text-sm font-bold text-[#10221b]">Ảnh đại diện</p>
								<p className="mt-0.5 text-xs text-[#627769]">
									Chọn ảnh JPG hoặc PNG (tối đa 5 MB). Ảnh sẽ hiển thị trên hồ sơ và lịch phân công.
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Họ và tên *
								<input
									type="text"
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									disabled={isBusy}
									placeholder="Nhập họ và tên"
									className={INPUT_CLASS}
								/>
							</label>

							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Email đăng nhập
								<input
									type="email"
									value={accountProfile?.email ?? ""}
									disabled
									className={INPUT_CLASS}
								/>
							</label>

							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Số điện thoại
								<input
									type="tel"
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									disabled={isBusy}
									placeholder="VD: 0905123456"
									className={INPUT_CLASS}
								/>
							</label>

							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Ngày sinh
								<input
									type="text"
									value={dateOfBirth}
									onChange={(e) => setDateOfBirth(e.target.value)}
									disabled={isBusy}
									placeholder="DD/MM/YYYY"
									className={INPUT_CLASS}
								/>
							</label>

							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Giới tính
								<select
									value={gender}
									onChange={(e) => setGender(e.target.value as "male" | "female" | "other")}
									disabled={isBusy}
									className={INPUT_CLASS}
								>
									<option value="male">Nam</option>
									<option value="female">Nữ</option>
									<option value="other">Khác</option>
								</select>
							</label>

							<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
								Địa chỉ
								<input
									type="text"
									value={address}
									onChange={(e) => setAddress(e.target.value)}
									disabled={isBusy}
									placeholder="VD: Đà Nẵng"
									className={INPUT_CLASS}
								/>
							</label>
						</div>

						<label className="block space-y-1 text-xs font-semibold text-[#10221b]">
							Giới thiệu ngắn
							<textarea
								rows={2}
								value={bio}
								onChange={(e) => setBio(e.target.value)}
								disabled={isBusy}
								placeholder="Chia sẻ ngắn về kinh nghiệm trekking và phong cách hỗ trợ đoàn..."
								className={`${INPUT_CLASS} resize-y`}
							/>
						</label>

						<div className="flex justify-end gap-2 pt-2">
							<Button type="button" variant="outline" disabled={isBusy} onClick={onClose}>
								Hủy
							</Button>
							<Button type="submit" disabled={isBusy} className="gap-1.5">
								{isSavingPersonal ? (
									<>
										<Loader2 size={14} className="animate-spin" />
										<span>Đang lưu...</span>
									</>
								) : (
									<>
										<Save size={14} />
										<span>Lưu thông tin</span>
									</>
								)}
							</Button>
						</div>
					</form>
				) : (
					<PorterProfileForm
						form={porterForm}
						isSaving={isPorterSaving}
						onSubmit={onPorterSubmit}
						onReset={onPorterReset}
						isDirty={isPorterDirty}
						embedded
					/>
				)}
			</div>
		</Modal>
	);
}
