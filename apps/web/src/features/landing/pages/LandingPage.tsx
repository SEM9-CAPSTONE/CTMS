import type React from "react";
import { useState } from "react";
import { AiAssistantSection } from "../components/AiAssistantSection";
import { FeaturedLocationsSection } from "../components/FeaturedLocationsSection";
import { Footer } from "../components/Footer";
import { HeaderNav } from "../components/HeaderNav";
import { HeroSection } from "../components/HeroSection";
import { MainFeaturesSection } from "../components/MainFeaturesSection";
import { MobileAppSection } from "../components/MobileAppSection";
import { SafetySection } from "../components/SafetySection";
import { SearchPanelSection } from "../components/SearchPanelSection";
import { FEATURED_DESTINATIONS } from "../constants";
import type { LandingPageProps } from "../types";

export const LandingPage: React.FC<LandingPageProps> = ({
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	const [filteredDestinations, setFilteredDestinations] = useState(FEATURED_DESTINATIONS);

	const handleSearch = (name: string, maxPrice: string, rating: string) => {
		let results = FEATURED_DESTINATIONS;

		if (name.trim()) {
			results = results.filter((dest) =>
				dest.title.toLowerCase().includes(name.trim().toLowerCase())
			);
		}

		if (maxPrice.trim()) {
			const max = Number(maxPrice);
			results = results.filter((dest) => {
				const priceVal = dest.price === "Miễn phí" ? 0 : Number(dest.price.replace(/[^0-9]/g, ""));
				return priceVal <= max;
			});
		}

		if (rating.trim()) {
			const minRating = Number(rating);
			results = results.filter((dest) => dest.rating >= minRating);
		}

		setFilteredDestinations(results);
	};

	const handleReset = () => {
		setFilteredDestinations(FEATURED_DESTINATIONS);
	};

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-5 py-6 font-sans text-[#10221b] antialiased">
			<div className="mx-auto max-w-[1240px]">
				<HeaderNav
					onNavigateToLogin={onNavigateToLogin}
					onNavigateToRegister={onNavigateToRegister}
				/>
				<HeroSection />
				<SearchPanelSection onSearch={handleSearch} onReset={handleReset} />
				<FeaturedLocationsSection items={filteredDestinations} />
				<MainFeaturesSection />
				<SafetySection />
				<AiAssistantSection />
				<MobileAppSection />
				<Footer />
			</div>
		</div>
	);
};
