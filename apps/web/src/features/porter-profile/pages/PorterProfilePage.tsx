import { AlertCircle, ArrowLeft, Briefcase, RefreshCw } from "lucide-react";
import { PorterCertificatesSection } from "../../porter-certificates/components/PorterCertificatesSection";
import { PorterCompetencySection } from "../components/PorterCompetencySection";
import { PorterLedTripHistory } from "../components/PorterLedTripHistory";
import { PorterProfileHeader } from "../components/PorterProfileHeader";
import { usePorterLedTripHistory } from "../hooks/usePorterLedTripHistory";
import { usePorterProfile } from "../hooks/usePorterProfile";

interface PorterProfilePageProps {
	onBackHome?: () => void;
	onNavigateToTrips?: () => void;
	onLogout?: (allDevices?: boolean) => Promise<void>;
}

export function PorterProfilePage({
	onBackHome,
	onNavigateToTrips: _onNavigateToTrips,
	onLogout: _onLogout,
}: PorterProfilePageProps) {
	// Profile Hook (read-only for header stats)
	const {
		profile,
		isLoading: isProfileLoading,
		errorMessage: profileError,
		reload: reloadProfile,
	} = usePorterProfile();

	const ledTripHistory = usePorterLedTripHistory();

	if (isProfileLoading && !profile) {
		return (
			<div
				data-testid="porter-profile-page-loading"
				className="flex h-screen w-full items-center justify-center bg-[#f4f7f2]"
			>
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-4 border-[#164027] border-t-transparent" />
					<p className="text-xs font-bold text-[#164027]">
						Đang tải thông tin hồ sơ người hỗ trợ...
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] font-sans antialiased text-[#10221b]">
			{/* Top Header */}
			<header className="border-b border-[#dfe8df] bg-white sticky top-0 z-30 shadow-2xs">
				<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
					<div className="flex items-center gap-3">
						{onBackHome && (
							<button
								type="button"
								onClick={onBackHome}
								aria-label="Quay lại Dashboard"
								className="rounded-xl border border-[#d2ded2] p-2 text-[#4a5e51] hover:bg-[#f4f7f2]"
							>
								<ArrowLeft size={18} />
							</button>
						)}
						<div className="flex size-10 items-center justify-center rounded-xl bg-[#e6f2f7] text-[#246b8e]">
							<Briefcase size={20} />
						</div>
						<div>
							<h1 className="text-lg font-extrabold text-[#10221b]">
								Hồ sơ & Kinh nghiệm người hỗ trợ
							</h1>
							<p className="text-xs text-[#627769]">
								Cập nhật kinh nghiệm và theo dõi các chuyến đã dẫn
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={async () => {
								await reloadProfile();
								await ledTripHistory.reload();
							}}
							className="flex items-center gap-1.5 rounded-xl border border-[#d2ded2] px-3.5 py-2 text-xs font-bold text-[#4a5e51] hover:bg-[#f4f7f2]"
						>
							<RefreshCw size={14} />
							<span>Làm mới</span>
						</button>
					</div>
				</div>
			</header>

			{/* Main Container */}
			<div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
				{profileError && (
					<div
						data-testid="profile-error-alert"
						className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-900 shadow-xs"
					>
						<AlertCircle size={16} className="shrink-0 text-red-600" />
						<span>{profileError}</span>
					</div>
				)}

				{/* Header Section with Read-only metrics */}
				<PorterProfileHeader profile={profile} />

				{/* Certificates & Credentials Section (CTMS-138) */}
				<PorterCertificatesSection />

				{/* Level Upgrade Requests Section */}
				<PorterCompetencySection />

				{/* Completed Trips History */}
				<PorterLedTripHistory
					items={ledTripHistory.items}
					isLoading={ledTripHistory.isLoading}
					errorMessage={ledTripHistory.errorMessage}
					pagination={ledTripHistory.pagination}
					onPageChange={ledTripHistory.setPage}
					onRetry={ledTripHistory.reload}
				/>
			</div>
		</div>
	);
}
