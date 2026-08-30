import { AlertCircle, Loader2, RefreshCw, TentTree } from "lucide-react";
import { useEffect, useState } from "react";
import { Collapse } from "../../../shared/components/Collapse";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { CampsiteResultCard } from "../components/CampsiteResultCard";
import { CampsitesPageHeader } from "../components/CampsitesPageHeader";
import { CampsitesPagination } from "../components/CampsitesPagination";
import { CampsitesSearchFilters } from "../components/CampsitesSearchFilters";
import { useCampsitesSearch } from "../hooks/useCampsitesSearch";

export interface SearchCampsitesPageProps {
	onNavigateDashboard?: () => void;
	onNavigateProfile?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function SearchCampsitesPage({
	onNavigateDashboard,
	onNavigateProfile,
	onLogout,
}: SearchCampsitesPageProps) {
	const searchState = useCampsitesSearch();
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

	useEffect(() => {
		let isMounted = true;
		camperProfileService
			.getProfile()
			.then((data) => {
				if (!isMounted) return;
				setProfile(data);
			})
			.catch(() => {});
		return () => {
			isMounted = false;
		};
	}, []);

	return (
		<div className="flex min-h-screen w-full bg-[#f4f7f2] font-sans antialiased text-[#10221b]">
			<Collapse
				isCollapsed={isSidebarCollapsed}
				onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
				widthClass="w-64"
			>
				<CamperSidebar
					profile={profile}
					activeNav="explore"
					onLogout={onLogout}
					onNavigate={(navKey) => {
						if (navKey === "overview") {
							onNavigateDashboard?.();
						} else if (navKey === "profile") {
							onNavigateProfile?.();
						}
					}}
					className="h-full w-full"
				/>
			</Collapse>

			{/* Main Content Area */}
			<div className="flex flex-1 flex-col min-w-0">
				<CampsitesPageHeader />

				<div className="mx-auto max-w-[1440px] w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
					{searchState.errorMessage && (
						<div
							role="alert"
							className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
						>
							<span className="flex items-center gap-2">
								<AlertCircle className="size-5" />
								{searchState.errorMessage}
							</span>
							<button
								type="button"
								onClick={() => void searchState.reload()}
								className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs text-white"
							>
								<RefreshCw className="size-4" /> Thử lại
							</button>
						</div>
					)}

					<div className="overflow-hidden rounded-2xl border border-[#e0ebe0] bg-white shadow-sm">
						<CampsitesSearchFilters
							amenities={searchState.amenitiesInput}
							minPrice={searchState.minPriceInput}
							maxPrice={searchState.maxPriceInput}
							isLoading={searchState.isLoading}
							onAmenitiesChange={searchState.setAmenitiesInput}
							onMinPriceChange={searchState.setMinPriceInput}
							onMaxPriceChange={searchState.setMaxPriceInput}
							onSubmit={searchState.submitFilters}
							onReset={searchState.resetFilters}
						/>

						{searchState.isLoading ? (
							<div className="flex items-center justify-center gap-3 p-16 text-sm font-bold text-[#54655a]">
								<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tìm kiếm khu cắm
								trại...
							</div>
						) : searchState.errorMessage ? (
							<div className="p-16 text-center">
								<AlertCircle className="mx-auto size-10 text-[#9aaba0]" />
								<p className="mt-3 font-bold text-[#10221b]">
									Không thể tải danh sách khu cắm trại
								</p>
								<p className="mt-1 text-sm text-[#667a6d]">Vui lòng thử lại sau.</p>
							</div>
						) : searchState.items.length === 0 ? (
							<div className="p-16 text-center">
								<TentTree className="mx-auto size-10 text-[#9aaba0]" />
								<p className="mt-3 font-bold text-[#10221b]">Không tìm thấy khu cắm trại phù hợp</p>
								<p className="mt-1 text-sm text-[#667a6d]">
									Hãy thay đổi bộ lọc tìm kiếm và thử lại.
								</p>
							</div>
						) : (
							<div className="p-5 border-t border-[#dfe8df]">
								<div className="mb-6">
									<p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#276143]">
										Điểm đến nổi bật
									</p>
									<h2 className="text-2xl font-extrabold tracking-tight text-[#10221b]">
										Những cung đường và bãi cắm được yêu thích nhất tháng này
									</h2>
								</div>
								<div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
									{searchState.items.map((campsite) => (
										<CampsiteResultCard key={campsite.id} campsite={campsite} />
									))}
								</div>
							</div>
						)}

						<CampsitesPagination
							pagination={searchState.pagination}
							disabled={searchState.isLoading}
							onPageChange={searchState.setPage}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
