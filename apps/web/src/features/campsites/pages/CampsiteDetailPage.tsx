import {
	AlertTriangle,
	ArrowLeft,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	Compass,
	MapPin,
	ShieldAlert,
	Star,
	Tent,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Collapse } from "../../../shared/components/Collapse";
import { CamperSidebar } from "../../camper-profile/components/CamperSidebar";
import { camperProfileService } from "../../camper-profile/services/camper-profile.service";
import type { CamperProfileData } from "../../camper-profile/types";
import { useCampsiteDetail } from "../hooks/useCampsiteDetail";

export interface CampsiteDetailPageProps {
	campsiteId: string;
	onBack?: () => void;
	onNavigateDashboard?: () => void;
	onNavigateProfile?: () => void;
	onLogout?: (allDevices: boolean) => Promise<void>;
}

export function CampsiteDetailPage({
	campsiteId,
	onBack,
	onNavigateDashboard,
	onNavigateProfile,
	onLogout,
}: CampsiteDetailPageProps) {
	const { campsite, isLoading, error, reload } = useCampsiteDetail(campsiteId);
	const [activeImageIndex, setActiveImageIndex] = useState(0);
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

	const hasImages = campsite ? campsite.media && campsite.media.length > 0 : false;
	const activeImage = campsite && hasImages ? campsite.media[activeImageIndex] : null;

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
				{isLoading ? (
					<>
						<header className="border-b border-[#e0ebe0] bg-white">
							<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
								<div className="flex items-center gap-3">
									<div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
								</div>
							</div>
						</header>

						<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
								<div className="space-y-6 lg:col-span-2">
									<div className="h-96 w-full animate-pulse rounded-2xl bg-gray-200" />
									<div className="space-y-3">
										<div className="h-6 w-1/4 animate-pulse rounded bg-gray-200" />
										<div className="h-4 w-full animate-pulse rounded bg-gray-200" />
										<div className="h-4 w-full animate-pulse rounded bg-gray-200" />
										<div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
									</div>
								</div>
								<div className="space-y-6">
									<div className="h-48 w-full animate-pulse rounded-2xl bg-gray-200" />
									<div className="h-64 w-full animate-pulse rounded-2xl bg-gray-200" />
								</div>
							</div>
						</main>
					</>
				) : error || !campsite ? (
					<>
						<header className="border-b border-[#e0ebe0] bg-white">
							<div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
								<button
									id="btn-back-error"
									type="button"
									onClick={onBack}
									className="inline-flex items-center gap-1.5 rounded-lg text-sm font-bold text-[#425048] hover:text-[#164027]"
								>
									<ArrowLeft className="size-4" /> Quay lại
								</button>
							</div>
						</header>

						<main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12">
							<div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
								<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-50">
									<AlertTriangle className="size-8 text-red-600" />
								</div>
								<h2 className="mt-4 text-lg font-bold text-[#10221b]">Không thể tải thông tin</h2>
								<p className="mt-2 text-sm text-red-700">
									{error || "Đã xảy ra lỗi không xác định."}
								</p>
								<div className="mt-6 flex justify-center gap-4">
									{onBack && (
										<button
											id="btn-error-back"
											type="button"
											onClick={onBack}
											className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
										>
											Quay lại danh sách
										</button>
									)}
									<button
										id="btn-retry"
										type="button"
										onClick={() => void reload()}
										className="inline-flex items-center gap-2 rounded-xl bg-[#2d5a27] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#23471e]"
									>
										Thử lại
									</button>
								</div>
							</div>
						</main>
					</>
				) : (
					<>
						<header className="border-b border-[#e0ebe0] bg-white">
							<div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
								<button
									id="btn-back"
									type="button"
									onClick={onBack}
									className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold text-[#425048] transition hover:bg-[#f1f5f0] hover:text-[#164027]"
								>
									<ArrowLeft className="size-4" /> Quay lại
								</button>
								<div className="flex items-center gap-2 rounded-lg bg-[#e8f0e6] px-3 py-1 text-xs font-bold text-[#164027]">
									<Tent className="size-4" /> Hoạt động
								</div>
							</div>
						</header>

						<main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
							<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
								{/* Left column: media + details */}
								<div className="space-y-6 lg:col-span-2">
									{/* Media slider */}
									<div className="overflow-hidden rounded-2xl border border-[#e0ebe0] bg-white shadow-sm">
										<div className="relative aspect-video w-full bg-[#f1f5f0]">
											{activeImage ? (
												<img
													src={activeImage.url}
													alt={`${campsite.name} - ${activeImageIndex + 1}`}
													className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
												/>
											) : (
												<div className="flex h-full w-full flex-col items-center justify-center text-[#9aaba0]">
													<Tent className="size-16" />
													<span className="mt-2 text-sm">Không có hình ảnh</span>
												</div>
											)}

											{hasImages && campsite.media.length > 1 && (
												<>
													<button
														id="btn-prev-image"
														type="button"
														onClick={() =>
															setActiveImageIndex((prev) =>
																prev === 0 ? campsite.media.length - 1 : prev - 1
															)
														}
														className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-[#10221b] backdrop-blur-sm transition hover:bg-white"
														aria-label="Previous image"
													>
														<ChevronLeft className="size-5" />
													</button>
													<button
														id="btn-next-image"
														type="button"
														onClick={() =>
															setActiveImageIndex((prev) =>
																prev === campsite.media.length - 1 ? 0 : prev + 1
															)
														}
														className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 text-[#10221b] backdrop-blur-sm transition hover:bg-white"
														aria-label="Next image"
													>
														<ChevronRight className="size-5" />
													</button>
												</>
											)}
										</div>

										{hasImages && campsite.media.length > 1 && (
											<div className="flex gap-2 overflow-x-auto border-t border-[#e0ebe0] p-4">
												{campsite.media.map((image, idx) => (
													<button
														key={image.id}
														id={`btn-thumbnail-${idx}`}
														type="button"
														onClick={() => setActiveImageIndex(idx)}
														className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
															idx === activeImageIndex
																? "border-[#164027] ring-2 ring-[#164027]/10"
																: "border-transparent opacity-60 hover:opacity-100"
														}`}
													>
														<img
															src={image.url}
															alt={`Thumbnail ${idx + 1}`}
															className="h-full w-full object-cover"
														/>
													</button>
												))}
											</div>
										)}
									</div>

									{/* Campsite details */}
									<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
										<h1 className="text-2xl font-extrabold text-[#10221b] sm:text-3xl">
											{campsite.name}
										</h1>
										<p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-[#667a6d]">
											<MapPin className="size-4 text-[#276143]" />
											{campsite.province}
										</p>

										{campsite.description && (
											<div className="mt-6 border-t border-[#f1f5f0] pt-6">
												<h2 className="text-lg font-bold text-[#10221b]">Giới thiệu</h2>
												<p className="mt-3 text-sm leading-relaxed text-[#425048]">
													{campsite.description}
												</p>
											</div>
										)}
									</div>

									{/* Reviews section (Static placeholder) */}
									<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
										<h2 className="text-lg font-bold text-[#10221b]">Đánh giá từ Camper</h2>
										<div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-[#f4f7f2] p-8 text-center border border-dashed border-[#e0ebe0]">
											<Star className="size-8 text-[#9aaba0]" />
											<p className="mt-3 font-bold text-[#34483b]">Chưa có đánh giá nào</p>
											<p className="mt-1 text-xs text-[#667a6d]">
												Hãy là người đầu tiên trải nghiệm và chia sẻ cảm nhận về khu cắm trại này!
											</p>
										</div>
									</div>
								</div>

								{/* Right column: facts + operating info */}
								<div className="space-y-6">
									{/* Location Coordinates Card */}
									<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
										<h2 className="text-base font-bold text-[#10221b] flex items-center gap-2">
											<Compass className="size-5 text-[#276143]" /> Vị trí tọa độ
										</h2>
										<div className="mt-4 space-y-2.5 text-sm">
											<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
												<span className="text-[#667a6d]">Tỉnh / Thành</span>
												<span className="font-bold text-[#10221b]">{campsite.province}</span>
											</div>
											<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
												<span className="text-[#667a6d]">Vĩ độ (Latitude)</span>
												<span className="font-mono font-semibold text-[#10221b]">
													{campsite.latitude.toFixed(6)}
												</span>
											</div>
											<div className="flex justify-between">
												<span className="text-[#667a6d]">Kinh độ (Longitude)</span>
												<span className="font-mono font-semibold text-[#10221b]">
													{campsite.longitude.toFixed(6)}
												</span>
											</div>
										</div>
									</div>

									{/* Policies & Rules */}
									{campsite.policies && (
										<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
											<h2 className="text-base font-bold text-[#10221b] flex items-center gap-2">
												<ShieldAlert className="size-5 text-[#276143]" /> Chính sách & Quy định
											</h2>
											<div className="mt-4 text-sm leading-relaxed text-[#425048] whitespace-pre-line">
												{typeof campsite.policies.rules === "string"
													? campsite.policies.rules
													: JSON.stringify(campsite.policies)}
											</div>
										</div>
									)}

									{/* Booking facts / Operating info */}
									<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
										<h2 className="text-base font-bold text-[#10221b] flex items-center gap-2">
											<Clock className="size-5 text-[#276143]" /> Thông tin vận hành
										</h2>
										<div className="mt-4 space-y-3 text-sm">
											{campsite.operatingHours && (
												<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
													<span className="text-[#667a6d]">Giờ mở cửa</span>
													<span className="font-bold text-[#10221b]">
														{String(campsite.operatingHours.opensAt || "08:00")} -{" "}
														{String(campsite.operatingHours.closesAt || "22:00")}
													</span>
												</div>
											)}
											{campsite.seasonStartDate && campsite.seasonEndDate && (
												<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
													<span className="text-[#667a6d]">Mùa hoạt động</span>
													<span className="font-bold text-[#10221b]">
														{campsite.seasonStartDate} đến {campsite.seasonEndDate}
													</span>
												</div>
											)}
											{campsite.minNights !== null && (
												<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
													<span className="text-[#667a6d]">Số đêm tối thiểu</span>
													<span className="font-bold text-[#10221b]">{campsite.minNights} đêm</span>
												</div>
											)}
											{campsite.maxNights !== null && (
												<div className="flex justify-between border-b border-[#f1f5f0] pb-2">
													<span className="text-[#667a6d]">Số đêm tối đa</span>
													<span className="font-bold text-[#10221b]">{campsite.maxNights} đêm</span>
												</div>
											)}
											{campsite.maxAdvanceBookingDays !== null && (
												<div className="flex justify-between">
													<span className="text-[#667a6d]">Đặt trước tối đa</span>
													<span className="font-bold text-[#10221b]">
														{campsite.maxAdvanceBookingDays} ngày
													</span>
												</div>
											)}
										</div>
									</div>

									{/* Upcoming trips section (Static placeholder) */}
									<div className="rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
										<h2 className="text-base font-bold text-[#10221b] flex items-center gap-2">
											<Calendar className="size-5 text-[#276143]" /> Chuyến đi sắp tới
										</h2>
										<div className="mt-4 flex flex-col items-center justify-center rounded-xl bg-[#f4f7f2] p-6 text-center border border-dashed border-[#e0ebe0]">
											<Tent className="size-6 text-[#9aaba0]" />
											<p className="mt-2 text-xs font-bold text-[#34483b]">
												Không có chuyến đi nào sắp diễn ra
											</p>
											<p className="mt-1 text-[11px] text-[#667a6d]">
												Khu cắm trại này hiện chưa có chuyến đi nào được công bố.
											</p>
										</div>
									</div>
								</div>
							</div>
						</main>
					</>
				)}
			</div>
		</div>
	);
}
