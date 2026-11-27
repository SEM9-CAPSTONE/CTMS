import { ArrowRight, Clock, MapPin, Mountain, Route, Search, ShieldCheck } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button, Modal, StatusBadge } from "../../../shared/components";
import { FEATURED_DESTINATIONS } from "../../landing/constants";
import type { DestinationCard } from "../../landing/types";
import { PublicPageLayout, type PublicPageProps } from "../components/PublicPageLayout";

const ZONE_OPTIONS = ["Tất cả", "Sơn Trà", "Hải Vân", "Hòa Vang", "Bà Nà"] as const;
const DIFFICULTY_OPTIONS = ["Tất cả", "Dễ", "Trung bình", "Thử thách"] as const;

export interface TrekkingExplorePageProps extends PublicPageProps {
	initialQuery?: string;
	initialRouteId?: string | null;
}

export const TrekkingExplorePage: React.FC<TrekkingExplorePageProps> = ({
	initialQuery = "",
	initialRouteId = null,
	onBackToHome,
	onNavigateToLogin,
	onNavigateToRegister,
	onNavigateToDashboard,
	onNavigateToPath,
}) => {
	const [searchText, setSearchText] = useState(initialQuery);
	const [selectedZone, setSelectedZone] = useState<string>("Tất cả");
	const [selectedDifficulty, setSelectedDifficulty] = useState<string>("Tất cả");
	const [activeRoute, setActiveRoute] = useState<DestinationCard | null>(() => {
		if (!initialRouteId) return null;
		return FEATURED_DESTINATIONS.find((item) => item.id === initialRouteId) ?? null;
	});

	useEffect(() => {
		if (initialRouteId) {
			const matched = FEATURED_DESTINATIONS.find((item) => item.id === initialRouteId) ?? null;
			setActiveRoute(matched);
		}
	}, [initialRouteId]);

	const filteredRoutes = useMemo(() => {
		const keyword = searchText.trim().toLowerCase();
		return FEATURED_DESTINATIONS.filter((item) => {
			if (selectedZone !== "Tất cả" && item.zone !== selectedZone) return false;
			if (selectedDifficulty !== "Tất cả" && item.difficulty !== selectedDifficulty) return false;
			if (!keyword) return true;
			const haystack = [item.title, item.location, item.zone ?? "", ...(item.highlights ?? [])]
				.join(" ")
				.toLowerCase();
			return haystack.includes(keyword);
		});
	}, [searchText, selectedZone, selectedDifficulty]);

	const resetFilters = () => {
		setSearchText("");
		setSelectedZone("Tất cả");
		setSelectedDifficulty("Tất cả");
	};

	const getDifficultyTone = (difficulty?: DestinationCard["difficulty"]) => {
		if (difficulty === "Dễ") return "success";
		if (difficulty === "Thử thách") return "warning";
		return "info";
	};

	return (
		<PublicPageLayout
			eyebrow="Danh mục tuyến dã ngoại và leo núi"
			title="Khám phá các tuyến đường nổi bật trên DiTrek"
			subtitle="Tra cứu thông số địa hình, thời gian di chuyển, tình trạng tuyến và kết nối trực tiếp đến các chuyến đi đang mở đăng ký của đơn vị tổ chức."
			onBackToHome={onBackToHome}
			onNavigateToLogin={onNavigateToLogin}
			onNavigateToRegister={onNavigateToRegister}
			onNavigateToDashboard={onNavigateToDashboard}
			headerAction={
				<Button
					variant="primary"
					size="sm"
					onClick={() => onNavigateToPath("/trips")}
					className="bg-[#164027] hover:bg-[#0f2e1c]"
				>
					<span>Xem chuyến đi đang mở</span>
					<ArrowRight className="ml-1.5 size-4" />
				</Button>
			}
		>
			{/* Quick metrics strip */}
			<section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<p className="text-xs font-medium tracking-wide text-[#54655a]">Tuyến tiêu biểu</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						{FEATURED_DESTINATIONS.length} tuyến
					</p>
					<p className="mt-1 text-xs text-[#667a6d]">Khu vực Đà Nẵng và vùng phụ cận</p>
				</div>
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<p className="text-xs font-medium tracking-wide text-[#54655a]">Phân loại độ khó</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">3 cấp độ</p>
					<p className="mt-1 text-xs text-[#667a6d]">Từ người mới đến người có kinh nghiệm</p>
				</div>
				<div className="rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
					<p className="text-xs font-medium tracking-wide text-[#54655a]">Theo dõi an toàn</p>
					<p className="mt-1.5 text-2xl font-bold tracking-tight text-[#10221b]">
						Thời tiết và bản đồ
					</p>
					<p className="mt-1 text-xs text-[#667a6d]">
						Đồng bộ dữ liệu thời tiết trước khi khởi hành
					</p>
				</div>
			</section>

			{/* Filter bar */}
			<section className="mt-6 rounded-2xl border border-[#dfe8df] bg-white p-5 shadow-xs">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="relative flex-1">
						<Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#54655a]" />
						<input
							type="text"
							value={searchText}
							onChange={(event) => setSearchText(event.target.value)}
							placeholder="Tìm theo tên tuyến, địa điểm hoặc điểm nổi bật..."
							className="w-full rounded-xl border border-[#dfe8df] bg-[#f7faf6] py-2.5 pr-4 pl-10 text-sm text-[#10221b] outline-none transition focus:border-[#164027] focus:bg-white"
						/>
					</div>

					<div className="flex flex-wrap items-center gap-2">
						{DIFFICULTY_OPTIONS.map((difficulty) => {
							const isActive = selectedDifficulty === difficulty;
							return (
								<button
									key={difficulty}
									type="button"
									onClick={() => setSelectedDifficulty(difficulty)}
									className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
										isActive
											? "bg-[#164027] text-white"
											: "border border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f4f7f2]"
									}`}
								>
									{difficulty === "Tất cả" ? "Mọi độ khó" : difficulty}
								</button>
							);
						})}
					</div>
				</div>

				<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#eef2ee] pt-4">
					<span className="mr-1 text-xs font-medium text-[#54655a]">Khu vực:</span>
					{ZONE_OPTIONS.map((zone) => {
						const isActive = selectedZone === zone;
						return (
							<button
								key={zone}
								type="button"
								onClick={() => setSelectedZone(zone)}
								className={`cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
									isActive
										? "bg-[#eef7f0] text-[#164027] ring-1 ring-[#164027]/30"
										: "text-[#425048] hover:bg-[#f4f7f2]"
								}`}
							>
								{zone}
							</button>
						);
					})}

					{(searchText || selectedZone !== "Tất cả" || selectedDifficulty !== "Tất cả") && (
						<button
							type="button"
							onClick={resetFilters}
							className="ml-auto cursor-pointer text-xs font-semibold text-[#164027] hover:underline"
						>
							Đặt lại bộ lọc
						</button>
					)}
				</div>
			</section>

			{/* Route grid */}
			{filteredRoutes.length === 0 ? (
				<section className="mt-6 rounded-2xl border border-dashed border-[#cfdcd0] bg-white p-10 text-center">
					<p className="text-base font-bold text-[#10221b]">
						Không tìm thấy tuyến đường phù hợp với bộ lọc hiện tại
					</p>
					<p className="mt-1 text-sm text-[#54655a]">
						Hãy thử xóa từ khóa hoặc chọn khu vực khác để xem toàn bộ tuyến đường trên DiTrek.
					</p>
					<Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
						Xem tất cả tuyến đường
					</Button>
				</section>
			) : (
				<section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{filteredRoutes.map((route) => (
						<article
							key={route.id ?? route.title}
							className="flex flex-col overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-xs transition duration-150 hover:border-[#bfd2c2]"
						>
							<div className="relative h-48 w-full overflow-hidden bg-[#10221b]">
								<img
									src={route.image}
									alt={route.title}
									className="h-full w-full object-cover"
									onError={(event) => {
										event.currentTarget.src = "/figma_assets/card_1.png";
									}}
								/>
								<div className="absolute top-3 right-3 left-3 flex items-center justify-between">
									{route.difficulty && (
										<StatusBadge tone={getDifficultyTone(route.difficulty)}>
											{route.difficulty}
										</StatusBadge>
									)}
									<span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[#10221b]">
										★ {route.rating}
									</span>
								</div>
							</div>

							<div className="flex flex-1 flex-col p-5">
								<h2 className="text-base font-bold text-[#10221b]">{route.title}</h2>
								<p className="mt-1 inline-flex items-center gap-1.5 text-xs text-[#54655a]">
									<MapPin className="size-3.5 text-[#164027]" />
									<span>{route.location}</span>
								</p>

								<div className="mt-4 grid grid-cols-3 gap-2 border-y border-[#eef2ee] py-3 text-center">
									<div>
										<span className="block text-[11px] text-[#667a6d]">Cự ly</span>
										<strong className="text-xs font-bold text-[#10221b]">
											{route.distance ?? "Đang cập nhật"}
										</strong>
									</div>
									<div>
										<span className="block text-[11px] text-[#667a6d]">Thời gian</span>
										<strong className="text-xs font-bold text-[#10221b]">
											{route.duration ?? "Đang cập nhật"}
										</strong>
									</div>
									<div>
										<span className="block text-[11px] text-[#667a6d]">Độ cao</span>
										<strong className="text-xs font-bold text-[#10221b]">
											{route.elevation ?? "Đang cập nhật"}
										</strong>
									</div>
								</div>

								<div className="mt-3 flex flex-wrap gap-1.5">
									<span className="rounded-lg bg-[#eef7f0] px-2.5 py-1 text-xs font-medium text-[#164027]">
										{route.weatherBadge}
									</span>
									<span className="rounded-lg bg-[#f4f7f2] px-2.5 py-1 text-xs font-medium text-[#425048]">
										{route.statusBadge}
									</span>
								</div>

								<div className="mt-auto flex items-center justify-between gap-2 pt-5">
									<div>
										<span className="block text-[11px] text-[#667a6d]">Chi phí tham khảo</span>
										<span className="text-sm font-bold text-[#164027]">{route.price}</span>
									</div>
									<div className="flex items-center gap-2">
										<Button variant="outline" size="sm" onClick={() => setActiveRoute(route)}>
											Chi tiết
										</Button>
										<Button
											variant="primary"
											size="sm"
											onClick={() => onNavigateToPath("/trips")}
											className="bg-[#164027] hover:bg-[#0f2e1c]"
										>
											Tìm chuyến
										</Button>
									</div>
								</div>
							</div>
						</article>
					))}
				</section>
			)}

			{/* Safety note CTA */}
			<section className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#dfe8df] bg-white p-6 shadow-xs sm:flex-row sm:items-center">
				<div className="flex items-start gap-3">
					<ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#164027]" />
					<div>
						<h2 className="text-base font-bold text-[#10221b]">
							Kiểm tra điều kiện an toàn trước khi khởi hành
						</h2>
						<p className="mt-1 text-sm text-[#425048]">
							Mọi chuyến đi trên DiTrek đều được gắn đánh giá rủi ro thời tiết, điểm kiểm soát tuyến
							và hướng dẫn an toàn theo khu vực.
						</p>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => onNavigateToPath("/safety")}
					className="shrink-0"
				>
					Xem trung tâm an toàn
				</Button>
			</section>

			<Modal
				isOpen={activeRoute !== null}
				onClose={() => setActiveRoute(null)}
				title={activeRoute?.title ?? "Chi tiết tuyến đường"}
				description={activeRoute?.location}
				size="xl"
			>
				{activeRoute && (
					<div className="space-y-5">
						<div className="overflow-hidden rounded-2xl bg-[#10221b]">
							<img
								src={activeRoute.image}
								alt={activeRoute.title}
								className="h-60 w-full object-cover"
								onError={(event) => {
									event.currentTarget.src = "/figma_assets/card_1.png";
								}}
							/>
						</div>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
							<div className="rounded-xl bg-[#f4f7f2] p-3.5">
								<div className="flex items-center gap-1.5 text-xs text-[#54655a]">
									<Route className="size-3.5 text-[#164027]" />
									<span>Cự ly dự kiến</span>
								</div>
								<p className="mt-1 text-sm font-bold text-[#10221b]">
									{activeRoute.distance ?? "Đang cập nhật"}
								</p>
							</div>
							<div className="rounded-xl bg-[#f4f7f2] p-3.5">
								<div className="flex items-center gap-1.5 text-xs text-[#54655a]">
									<Clock className="size-3.5 text-[#164027]" />
									<span>Thời gian di chuyển</span>
								</div>
								<p className="mt-1 text-sm font-bold text-[#10221b]">
									{activeRoute.duration ?? "Đang cập nhật"}
								</p>
							</div>
							<div className="rounded-xl bg-[#f4f7f2] p-3.5">
								<div className="flex items-center gap-1.5 text-xs text-[#54655a]">
									<Mountain className="size-3.5 text-[#164027]" />
									<span>Chênh lệch độ cao</span>
								</div>
								<p className="mt-1 text-sm font-bold text-[#10221b]">
									{activeRoute.elevation ?? "Đang cập nhật"}
								</p>
							</div>
						</div>

						{activeRoute.highlights && activeRoute.highlights.length > 0 && (
							<div>
								<h3 className="text-sm font-bold text-[#10221b]">Điểm nổi bật trên tuyến</h3>
								<div className="mt-2 flex flex-wrap gap-2">
									{activeRoute.highlights.map((highlight) => (
										<span
											key={highlight}
											className="rounded-lg border border-[#dfe8df] bg-[#f7faf6] px-3 py-1 text-xs font-medium text-[#254431]"
										>
											{highlight}
										</span>
									))}
								</div>
							</div>
						)}

						<div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2ee] pt-4">
							<div>
								<span className="block text-xs text-[#54655a]">Chi phí tham khảo</span>
								<strong className="text-base font-extrabold text-[#164027]">
									{activeRoute.price}
								</strong>
							</div>
							<div className="flex flex-wrap gap-2">
								<Button variant="outline" size="sm" onClick={() => setActiveRoute(null)}>
									Đóng
								</Button>
								<Button
									variant="primary"
									size="sm"
									onClick={() => {
										setActiveRoute(null);
										onNavigateToPath("/trips");
									}}
									className="bg-[#164027] hover:bg-[#0f2e1c]"
								>
									Xem chuyến đi đang mở
								</Button>
							</div>
						</div>
					</div>
				)}
			</Modal>
		</PublicPageLayout>
	);
};
