import { ChevronRight } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { CampsitesSearchFilters } from "../../campsites/components/CampsitesSearchFilters";

interface SearchPanelSectionProps {
	onSearch: (name: string, maxPrice: string, rating: string) => void;
	onReset: () => void;
}

export const SearchPanelSection: React.FC<SearchPanelSectionProps> = ({ onSearch, onReset }) => {
	const [name, setName] = useState("");
	const [maxPrice, setMaxPrice] = useState("");
	const [rating, setRating] = useState("");

	const handleSubmit = () => {
		onSearch(name, maxPrice, rating);
	};

	const handleReset = () => {
		setName("");
		setMaxPrice("");
		setRating("");
		onReset();
	};

	return (
		<section className="mb-12 rounded-3xl border border-[#dfe8df] bg-white p-8 shadow-xl shadow-[#1c442f]/5">
			<div className="mb-6 flex flex-wrap items-end justify-between gap-4">
				<div>
					<p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-[#276143]">
						Điểm đến nổi bật
					</p>
					<h2 className="text-2xl font-extrabold tracking-tight text-[#10221b]">
						Những cung đường và bãi cắm được yêu thích nhất tháng này
					</h2>
				</div>
				<a
					href="/campsites"
					onClick={(e) => {
						e.preventDefault();
						window.history.pushState({}, "", "/campsites");
						window.dispatchEvent(new PopStateEvent("popstate"));
					}}
					className="inline-flex items-center gap-1 text-sm font-bold text-[#276143] hover:underline"
				>
					Xem tất cả <ChevronRight size={16} />
				</a>
			</div>

			<CampsitesSearchFilters
				name={name}
				maxPrice={maxPrice}
				rating={rating}
				isLoading={false}
				onNameChange={setName}
				onMaxPriceChange={setMaxPrice}
				onRatingChange={setRating}
				onSubmit={handleSubmit}
				onReset={handleReset}
				className="bg-transparent p-0"
			/>
		</section>
	);
};
