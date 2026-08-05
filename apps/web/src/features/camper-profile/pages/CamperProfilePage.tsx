import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { HealthProfileContainer } from "../../health-profile/routes";
import { AvatarProfileCard } from "../components/AvatarProfileCard";
import { CamperHeader } from "../components/CamperHeader";
import { CamperSidebar } from "../components/CamperSidebar";
import { ExperienceSkillsForm } from "../components/ExperienceSkillsForm";
import { PersonalProfileForm } from "../components/PersonalProfileForm";
import { ProfileCompletionCard } from "../components/ProfileCompletionCard";
import { SettingsSubNav } from "../components/SettingsSubNav";
import { UnsavedChangesBar } from "../components/UnsavedChangesBar";
import { SettingsTabEnum } from "../enums/settings-tab.enum";
import { useCamperProfile } from "../hooks/useCamperProfile";

interface CamperProfilePageProps {
	onBackHome?: () => void;
}

export function CamperProfilePage({ onBackHome }: CamperProfilePageProps) {
	const [activeTab, setActiveTab] = useState<SettingsTabEnum>(SettingsTabEnum.PERSONAL_PROFILE);
	const [activeNav, setActiveNav] = useState<string>("profile");

	const {
		profile,
		isLoading,
		isSaving,
		saveSuccessMessage,
		form,
		languages,
		isFormDirty,
		handleAddLanguage,
		handleRemoveLanguage,
		handleResetForm,
		handleAvatarChange,
		handleSubmit,
	} = useCamperProfile();

	if (isLoading) {
		return (
			<div className="flex h-screen w-full items-center justify-center bg-[#f4f7f2]">
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-4 border-[#164027] border-t-transparent" />
					<p className="text-xs font-bold text-[#164027]">Đang tải hồ sơ Camper...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen w-full bg-[#f4f7f2] font-sans antialiased text-[#10221b]">
			{/* Left Navigation Sidebar */}
			<CamperSidebar
				profile={profile}
				activeNav={activeNav}
				onNavigate={(navKey) => setActiveNav(navKey)}
			/>

			{/* Main Content Area */}
			<div className="flex flex-1 flex-col min-w-0">
				{/* Top Header */}
				<CamperHeader profile={profile} onBackHome={onBackHome} />

				{/* Success Toast */}
				{saveSuccessMessage && (
					<div className="mx-8 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-sm animate-in fade-in">
						<CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
						<span>{saveSuccessMessage}</span>
					</div>
				)}

				{/* Page Content Container */}
				<main className="flex-1 p-6 sm:p-8">
					<div className="mx-auto flex max-w-7xl flex-col gap-6">
						{/* User Avatar & Info Header Card */}
						{profile && <AvatarProfileCard profile={profile} onAvatarChange={handleAvatarChange} />}

						{/* Main Settings Grid */}
						<div className="flex flex-col md:flex-row items-start gap-6">
							{/* Left Settings Sub-Nav & Completion Widget */}
							<div className="flex w-full md:w-64 shrink-0 flex-col gap-4">
								<SettingsSubNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />
								{profile && (
									<ProfileCompletionCard
										profile={profile}
										onSelectTab={(tab) => setActiveTab(tab)}
									/>
								)}
							</div>

							{/* Center Main Form Panels (Expands across full remaining width) */}
							<div className="flex-1 flex flex-col gap-6 w-full min-w-0">
								{activeTab === SettingsTabEnum.PERSONAL_PROFILE && (
									<form onSubmit={handleSubmit} className="flex flex-col gap-6">
										<PersonalProfileForm form={form} />
										<ExperienceSkillsForm
											form={form}
											languages={languages}
											onAddLanguage={handleAddLanguage}
											onRemoveLanguage={handleRemoveLanguage}
										/>
									</form>
								)}

								{activeTab === SettingsTabEnum.HEALTH_FITNESS && <HealthProfileContainer />}

								{activeTab !== SettingsTabEnum.PERSONAL_PROFILE &&
									activeTab !== SettingsTabEnum.HEALTH_FITNESS && (
										<div className="flex flex-col items-center justify-center rounded-2xl border border-[#e0ebe0] bg-white p-12 text-center shadow-sm">
											<div className="flex items-center justify-center rounded-2xl bg-[#eef7f0] p-2.5 mb-3">
												<img
													src="/ctms_logo.png"
													alt="CTMS Logo"
													className="h-10 w-auto object-contain"
												/>
											</div>
											<h3 className="font-extrabold text-base text-[#164027]">
												Mục cài đặt đang phát triển
											</h3>
											<p className="mt-1 text-xs font-medium text-[#627769] max-w-md">
												Tính năng đang được chuẩn bị để mang lại trải nghiệm quản lý an toàn và tối
												ưu nhất cho Camper.
											</p>
										</div>
									)}
							</div>
						</div>
					</div>
				</main>
			</div>

			{/* Floating Unsaved Changes Bar */}
			<UnsavedChangesBar
				isVisible={isFormDirty}
				isSaving={isSaving}
				onSave={handleSubmit}
				onReset={handleResetForm}
			/>
		</div>
	);
}
