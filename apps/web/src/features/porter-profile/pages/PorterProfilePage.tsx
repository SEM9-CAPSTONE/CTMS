import { AlertCircle, ArrowLeft, Briefcase, CheckCircle2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { tripsService } from "../../trips/services/trips.service";
import { PorterProfileForm } from "../components/PorterProfileForm";
import { PorterProfileHeader } from "../components/PorterProfileHeader";
import { PorterQualificationsPanel } from "../components/PorterQualificationsPanel";
import { usePorterProfile } from "../hooks/usePorterProfile";
import { usePorterRouteQualifications } from "../hooks/usePorterRouteQualifications";

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
	const [availableRoutes, setAvailableRoutes] = useState<Array<{ id: string; name: string }>>([]);

	// Profile Hook
	const {
		profile,
		isLoading: isProfileLoading,
		isSaving: isProfileSaving,
		saveSuccessMessage,
		errorMessage: profileError,
		conflictMessage: profileConflictMessage,
		form,
		isDirty,
		reload: reloadProfile,
		handleResetForm,
		handleSubmit,
	} = usePorterProfile();

	// Qualifications Hook
	const {
		qualifications,
		isLoading: isQualsLoading,
		isSubmitting: isQualSubmitting,
		errorMessage: qualError,
		successMessage: qualSuccessMessage,
		conflictMessage: qualConflictMessage,
		reload: reloadQuals,
		upsertQualification,
	} = usePorterRouteQualifications();

	// Fetch available published trips/routes for discovery
	useEffect(() => {
		let isMounted = true;
		tripsService
			.search({ limit: 10 })
			.then(async (res) => {
				if (!isMounted) return;
				const details = await Promise.all(
					res.items.map((t) => tripsService.getById(t.id).catch(() => null))
				);
				if (!isMounted) return;
				const routeMap = new Map<string, string>();
				for (const d of details) {
					if (d?.routeId) {
						routeMap.set(d.routeId, d.title);
					}
				}
				const list = Array.from(routeMap.entries()).map(([id, name]) => ({
					id,
					name,
				}));
				setAvailableRoutes(list);
			})
			.catch(() => {
				// non-fatal, fallback to manual Route ID
			});

		return () => {
			isMounted = false;
		};
	}, []);

	if (isProfileLoading && !profile) {
		return (
			<div
				data-testid="porter-profile-page-loading"
				className="flex h-screen w-full items-center justify-center bg-[#f4f7f2]"
			>
				<div className="flex flex-col items-center gap-3">
					<div className="size-10 animate-spin rounded-full border-4 border-[#164027] border-t-transparent" />
					<p className="text-xs font-bold text-[#164027]">Đang tải thông tin hồ sơ Porter...</p>
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
								Hồ sơ & Năng lực chuyên môn Porter
							</h1>
							<p className="text-xs text-[#627769]">
								Cập nhật kinh nghiệm, chứng chỉ và đăng ký năng lực tuyến leo núi
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={async () => {
								await reloadProfile();
								await reloadQuals();
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
			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
				{/* Top Global Alerts */}
				{saveSuccessMessage && (
					<div
						data-testid="profile-success-alert"
						className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-900 shadow-xs animate-in fade-in"
					>
						<CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
						<span>{saveSuccessMessage}</span>
					</div>
				)}

				{profileConflictMessage && (
					<div
						data-testid="profile-conflict-alert"
						className="flex items-center gap-2.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900 shadow-xs"
					>
						<AlertCircle size={16} className="shrink-0 text-amber-600" />
						<span>{profileConflictMessage}</span>
					</div>
				)}

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

				{/* Profile Edit Form */}
				<PorterProfileForm
					form={form}
					isSaving={isProfileSaving}
					onSubmit={handleSubmit}
					onReset={handleResetForm}
					isDirty={isDirty}
				/>

				{/* Route Qualifications Section */}
				<PorterQualificationsPanel
					qualifications={qualifications}
					isLoading={isQualsLoading}
					isSubmitting={isQualSubmitting}
					errorMessage={qualError}
					successMessage={qualSuccessMessage}
					conflictMessage={qualConflictMessage}
					availableRoutes={availableRoutes}
					onUpsert={upsertQualification}
					onReload={reloadQuals}
				/>
			</main>
		</div>
	);
}
