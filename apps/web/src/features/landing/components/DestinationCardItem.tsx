import { Camera, ChevronLeft, ChevronRight, Clock, Mountain, Route } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { DestinationCard } from "../types";

interface DestinationCardItemProps {
	destination: DestinationCard;
	onOpenGallery: (dest: DestinationCard, index: number) => void;
}

export const DestinationCardItem: React.FC<DestinationCardItemProps> = ({
	destination,
	onOpenGallery,
}) => {
	const [activePhotoIndex, setActivePhotoIndex] = useState(0);

	const photos =
		destination.images && destination.images.length > 0 ? destination.images : [destination.image];

	const handlePrevPhoto = (e: React.MouseEvent) => {
		e.stopPropagation();
		setActivePhotoIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
	};

	const handleNextPhoto = (e: React.MouseEvent) => {
		e.stopPropagation();
		setActivePhotoIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
	};

	const handleNavigate = () => {
		window.history.pushState({}, "", "/trekking");
		window.dispatchEvent(new PopStateEvent("popstate"));
	};

	return (
		<article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-md shadow-[#1c442f]/6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-[#1c442f]/14">
			{/* Photo Carousel Area */}
			<div className="relative h-60 w-full overflow-hidden bg-[#10221b]">
				<img
					key={photos[activePhotoIndex]}
					src={photos[activePhotoIndex]}
					alt={`${destination.title} - ảnh ${activePhotoIndex + 1}`}
					className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
					onError={(e) => {
						e.currentTarget.src = "/figma_assets/card_1.png";
					}}
				/>

				{/* Top Badges */}
				<div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between pointer-events-none">
					{destination.difficulty && (
						<span className="pointer-events-auto rounded-full bg-[#10221b]/80 px-3 py-1 text-xs font-bold text-white backdrop-blur-md">
							{destination.difficulty}
						</span>
					)}
					<span className="pointer-events-auto ml-auto rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-[#d87d05] shadow-sm backdrop-blur-md">
						★ {destination.rating}
						{destination.reviewCount ? ` (${destination.reviewCount})` : ""}
					</span>
				</div>

				{/* Mini prev/next photo buttons inside card */}
				{photos.length > 1 && (
					<>
						<button
							type="button"
							onClick={handlePrevPhoto}
							className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-black/75 hover:scale-110"
							title="Ảnh trước"
						>
							<ChevronLeft size={16} />
						</button>
						<button
							type="button"
							onClick={handleNextPhoto}
							className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-black/75 hover:scale-110"
							title="Ảnh tiếp theo"
						>
							<ChevronRight size={16} />
						</button>
					</>
				)}

				{/* Bottom photo dots & gallery trigger */}
				<div className="absolute bottom-3 inset-x-3.5 flex items-center justify-between">
					{/* Dots indicator */}
					{photos.length > 1 ? (
						<div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
							{photos.map((photoUrl, idx) => (
								<button
									key={`dot-${destination.title}-${photoUrl}`}
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setActivePhotoIndex(idx);
									}}
									className={`h-1.5 rounded-full transition-all duration-300 ${
										idx === activePhotoIndex
											? "w-4 bg-white"
											: "w-1.5 bg-white/50 hover:bg-white/80"
									}`}
								/>
							))}
						</div>
					) : (
						<div />
					)}

					{/* View trip photos button */}
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onOpenGallery(destination, activePhotoIndex);
						}}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#10221b] shadow-sm backdrop-blur-md transition hover:bg-white hover:scale-105"
					>
						<Camera size={13} className="text-[#276143]" />
						<span>{photos.length} ảnh</span>
					</button>
				</div>
			</div>

			{/* Card Body */}
			<div className="flex flex-1 flex-col p-5">
				<div className="mb-2">
					<h3 className="line-clamp-1 text-base font-extrabold text-[#10221b] group-hover:text-[#1c442f] transition-colors">
						{destination.title}
					</h3>
					<p className="mt-0.5 text-xs font-medium text-[#425048]">📍 {destination.location}</p>
				</div>

				{/* Trekking Specs */}
				<div className="my-2.5 grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f7faf6] p-2.5 border border-[#e8efe8] text-center">
					{destination.distance && (
						<div className="flex flex-col items-center">
							<span className="flex items-center gap-1 text-[11px] text-[#54655a]">
								<Route size={12} className="text-[#276143]" /> Cự ly
							</span>
							<strong className="mt-0.5 text-xs font-bold text-[#10221b]">
								{destination.distance}
							</strong>
						</div>
					)}
					{destination.duration && (
						<div className="flex flex-col items-center">
							<span className="flex items-center gap-1 text-[11px] text-[#54655a]">
								<Clock size={12} className="text-[#276143]" /> Thời gian
							</span>
							<strong className="mt-0.5 text-xs font-bold text-[#10221b]">
								{destination.duration}
							</strong>
						</div>
					)}
					{destination.elevation && (
						<div className="flex flex-col items-center">
							<span className="flex items-center gap-1 text-[11px] text-[#54655a]">
								<Mountain size={12} className="text-[#276143]" /> Cao độ
							</span>
							<strong className="mt-0.5 text-xs font-bold text-[#10221b]">
								{destination.elevation}
							</strong>
						</div>
					)}
				</div>

				{/* Weather & Safety Badges */}
				<div className="mb-3.5 flex flex-wrap gap-1.5">
					<span className="rounded-lg bg-[#eef7f0] px-2.5 py-1 text-[11px] font-bold text-[#276143]">
						{destination.weatherBadge}
					</span>
					<span className="rounded-lg bg-[#f4f6f4] px-2.5 py-1 text-[11px] font-bold text-[#425048]">
						{destination.statusBadge}
					</span>
				</div>

				{/* Highlights */}
				{destination.highlights && destination.highlights.length > 0 && (
					<div className="mb-4 flex flex-wrap gap-1">
						{destination.highlights.slice(0, 3).map((item) => (
							<span
								key={item}
								className="rounded-md bg-[#fafbfa] border border-[#e6ece6] px-2 py-0.5 text-[10px] text-[#526358] font-medium"
							>
								{item}
							</span>
						))}
					</div>
				)}

				{/* Footer with Price and Action */}
				<div className="mt-auto flex items-center justify-between border-t border-dashed border-[#dfe8df] pt-3.5">
					<div>
						<span className="block text-[11px] text-[#54655a]">Chi phí dự kiến</span>
						<span className="text-base font-extrabold text-[#1c442f]">{destination.price}</span>
					</div>
					<button
						type="button"
						onClick={handleNavigate}
						className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[#1c442f] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#143323] hover:shadow-md"
					>
						Xem lộ trình
					</button>
				</div>
			</div>
		</article>
	);
};
