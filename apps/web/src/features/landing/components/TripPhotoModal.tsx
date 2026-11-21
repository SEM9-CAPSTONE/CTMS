import { ChevronLeft, ChevronRight, MapPin, X } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { DestinationCard } from "../types";

interface TripPhotoModalProps {
	isOpen: boolean;
	destination: DestinationCard | null;
	initialIndex?: number;
	onClose: () => void;
}

export const TripPhotoModal: React.FC<TripPhotoModalProps> = ({
	isOpen,
	destination,
	initialIndex = 0,
	onClose,
}) => {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);

	const photoList =
		destination?.images && destination.images.length > 0
			? destination.images
			: destination?.image
				? [destination.image]
				: [];

	const handlePrev = useCallback(() => {
		setCurrentIndex((prev) => (prev === 0 ? photoList.length - 1 : prev - 1));
	}, [photoList.length]);

	const handleNext = useCallback(() => {
		setCurrentIndex((prev) => (prev === photoList.length - 1 ? 0 : prev + 1));
	}, [photoList.length]);

	useEffect(() => {
		setCurrentIndex(initialIndex);
	}, [initialIndex]);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "ArrowLeft") handlePrev();
			if (e.key === "ArrowRight") handleNext();
		};

		window.addEventListener("keydown", handleKeyDown);
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen, onClose, handlePrev, handleNext]);

	if (!isOpen || !destination) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm transition-opacity"
			onClick={onClose}
		>
			<div
				className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-[#10221b] text-white shadow-2xl"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Top Bar */}
				<div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
					<div>
						<h3 className="text-base font-extrabold text-white">{destination.title}</h3>
						<p className="flex items-center gap-1.5 text-xs text-[#a0c5b0]">
							<MapPin size={13} /> {destination.location}
						</p>
					</div>
					<div className="flex items-center gap-3">
						<span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
							{currentIndex + 1} / {photoList.length}
						</span>
						<button
							type="button"
							onClick={onClose}
							className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20 hover:text-white"
						>
							<X size={18} />
						</button>
					</div>
				</div>

				{/* Image Stage */}
				<div className="relative flex min-h-[380px] max-h-[60vh] flex-1 items-center justify-center bg-black/40">
					<img
						src={photoList[currentIndex]}
						alt={`${destination.title} - Ảnh ${currentIndex + 1}`}
						className="max-h-[58vh] w-full object-contain transition-all duration-300"
						onError={(e) => {
							e.currentTarget.src = "/figma_assets/card_1.png";
						}}
					/>

					{photoList.length > 1 && (
						<>
							<button
								type="button"
								onClick={handlePrev}
								className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white backdrop-blur-sm transition hover:bg-black/90 hover:scale-105"
							>
								<ChevronLeft size={22} />
							</button>
							<button
								type="button"
								onClick={handleNext}
								className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-white backdrop-blur-sm transition hover:bg-black/90 hover:scale-105"
							>
								<ChevronRight size={22} />
							</button>
						</>
					)}
				</div>

				{/* Thumbnails strip */}
				{photoList.length > 1 && (
					<div className="flex items-center justify-center gap-2.5 overflow-x-auto border-t border-white/10 bg-[#0c1a14] p-4">
						{photoList.map((img, idx) => (
							<button
								key={`thumb-${img}`}
								type="button"
								onClick={() => setCurrentIndex(idx)}
								className={`h-14 w-20 overflow-hidden rounded-xl border-2 transition-all ${
									idx === currentIndex
										? "border-[#276143] scale-105 opacity-100 ring-2 ring-[#4caf50]"
										: "border-transparent opacity-50 hover:opacity-80"
								}`}
							>
								<img
									src={img}
									alt={`thumbnail ${idx + 1}`}
									className="h-full w-full object-cover"
									onError={(e) => {
										e.currentTarget.src = "/figma_assets/card_1.png";
									}}
								/>
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
