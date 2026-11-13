import { ChevronLeft, ChevronRight, Compass, Sparkles } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { FEATURED_DESTINATIONS } from "../constants";
import type { DestinationCard } from "../types";
import { DestinationCardItem } from "./DestinationCardItem";
import { TripPhotoModal } from "./TripPhotoModal";

interface FeaturedLocationsSectionProps {
	items?: DestinationCard[];
}

const ZONES = ["Tất cả", "Sơn Trà", "Hải Vân", "Hòa Vang", "Bà Nà"] as const;

export const FeaturedLocationsSection: React.FC<FeaturedLocationsSectionProps> = ({
	items = FEATURED_DESTINATIONS,
}) => {
	const [selectedZone, setSelectedZone] = useState<string>("Tất cả");
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPaused, setIsPaused] = useState(false);
	const [activeGalleryModal, setActiveGalleryModal] = useState<{
		isOpen: boolean;
		destination: DestinationCard | null;
		initialIndex: number;
	}>({
		isOpen: false,
		destination: null,
		initialIndex: 0,
	});

	// Filter items by zone
	const filteredItems = useMemo(() => {
		if (selectedZone === "Tất cả") return items;
		return items.filter((item) => item.zone === selectedZone);
	}, [items, selectedZone]);

	// Responsive items per page: 3 on desktop, 2 on tablet, 1 on mobile
	const [visibleCount, setVisibleCount] = useState(3);

	useEffect(() => {
		const updateVisibleCount = () => {
			if (window.innerWidth < 640) {
				setVisibleCount(1);
			} else if (window.innerWidth < 1024) {
				setVisibleCount(2);
			} else {
				setVisibleCount(3);
			}
		};
		updateVisibleCount();
		window.addEventListener("resize", updateVisibleCount);
		return () => window.removeEventListener("resize", updateVisibleCount);
	}, []);

	// Reset index when filter changes
	useEffect(() => {
		if (selectedZone) {
			setCurrentIndex(0);
		}
	}, [selectedZone]);

	const maxIndex = Math.max(0, filteredItems.length - visibleCount);

	// Auto-slide every 5.5 seconds when not paused and there are multiple slides
	useEffect(() => {
		if (isPaused || maxIndex <= 0) return;

		const timer = setInterval(() => {
			setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
		}, 5500);

		return () => clearInterval(timer);
	}, [isPaused, maxIndex]);

	const handlePrev = () => {
		setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
	};

	const handleNext = () => {
		setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
	};

	const openGallery = (destination: DestinationCard, photoIndex: number) => {
		setActiveGalleryModal({
			isOpen: true,
			destination,
			initialIndex: photoIndex,
		});
	};

	const closeGallery = () => {
		setActiveGalleryModal((prev) => ({ ...prev, isOpen: false }));
	};

	return (
		<section
			className="mb-16"
			onMouseEnter={() => setIsPaused(true)}
			onMouseLeave={() => setIsPaused(false)}
		>
			{/* Section Header */}
			<div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<div className="mb-2 flex items-center gap-2">
						<span className="inline-flex items-center gap-1 rounded-full bg-[#276143]/10 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#276143]">
							<Compass size={13} /> Điểm đến nổi bật
						</span>
						<span className="text-xs font-semibold text-[#54655a]">
							• Tuyệt tác thiên nhiên Đà Nẵng
						</span>
					</div>
					<h2 className="text-2xl font-extrabold tracking-tight text-[#10221b] md:text-3xl">
						Những cung đường trekking được yêu thích nhất tháng này
					</h2>
				</div>

				{/* Controls & See all */}
				<div className="flex flex-wrap items-center gap-3">
					<a
						href="/trekking"
						onClick={(e) => {
							e.preventDefault();
							window.history.pushState({}, "", "/trekking");
							window.dispatchEvent(new PopStateEvent("popstate"));
						}}
						className="inline-flex items-center gap-1 text-sm font-bold text-[#276143] hover:underline mr-2"
					>
						Xem tất cả <ChevronRight size={16} />
					</a>

					{/* Slide indicator & nav buttons */}
					<div className="flex items-center gap-1.5 rounded-full border border-[#dfe8df] bg-white px-2 py-1 shadow-sm">
						<span className="px-2 text-xs font-bold text-[#425048]">
							{String(currentIndex + 1).padStart(2, "0")} /{" "}
							{String(Math.max(1, filteredItems.length)).padStart(2, "0")}
						</span>
						<button
							type="button"
							onClick={handlePrev}
							disabled={filteredItems.length <= visibleCount}
							aria-label="Cung đường trước"
							className="rounded-full p-1.5 text-[#10221b] transition hover:bg-[#f2f7f2] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
						>
							<ChevronLeft size={16} />
						</button>
						<button
							type="button"
							onClick={handleNext}
							disabled={filteredItems.length <= visibleCount}
							aria-label="Cung đường tiếp theo"
							className="rounded-full p-1.5 text-[#10221b] transition hover:bg-[#f2f7f2] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				</div>
			</div>

			{/* Zone Filter Tabs */}
			<div className="mb-6 flex flex-wrap items-center gap-2">
				{ZONES.map((zone) => {
					const isActive = selectedZone === zone;
					return (
						<button
							key={zone}
							type="button"
							onClick={() => setSelectedZone(zone)}
							className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
								isActive
									? "bg-[#1c442f] text-white shadow-sm"
									: "border border-[#dfe8df] bg-white text-[#425048] hover:bg-[#f7faf6]"
							}`}
						>
							{zone}
						</button>
					);
				})}
				<span className="ml-auto hidden text-xs font-medium text-[#54655a] lg:inline-flex items-center gap-1">
					<Sparkles size={13} className="text-[#276143]" /> Rê chuột vào ảnh để lướt xem các góc
					chụp
				</span>
			</div>

			{/* Carousel Slider Viewport */}
			{filteredItems.length === 0 ? (
				<div className="rounded-3xl border border-dashed border-[#dfe8df] bg-white p-12 text-center text-sm font-bold text-[#54655a]">
					Không tìm thấy địa điểm nào phù hợp với khu vực đã chọn.
				</div>
			) : (
				<div className="relative overflow-hidden">
					<div
						className="flex gap-6 transition-transform duration-500 ease-out"
						style={{
							transform: `translateX(-${currentIndex * (100 / visibleCount + (visibleCount > 1 ? (visibleCount === 2 ? 1.5 : 1) : 0))}%)`,
						}}
					>
						{filteredItems.map((dest) => (
							<div
								key={dest.id || dest.title}
								className="shrink-0"
								style={{
									width:
										visibleCount === 1
											? "100%"
											: visibleCount === 2
												? "calc(50% - 12px)"
												: "calc(33.333% - 16px)",
								}}
							>
								<DestinationCardItem destination={dest} onOpenGallery={openGallery} />
							</div>
						))}
					</div>
				</div>
			)}

			{/* Lightbox Photo Modal */}
			<TripPhotoModal
				isOpen={activeGalleryModal.isOpen}
				destination={activeGalleryModal.destination}
				initialIndex={activeGalleryModal.initialIndex}
				onClose={closeGallery}
			/>
		</section>
	);
};
