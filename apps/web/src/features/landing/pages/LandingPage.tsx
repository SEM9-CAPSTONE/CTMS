import type React from "react";
import { AiAssistantSection } from "../components/AiAssistantSection";
import { FeaturedLocationsSection } from "../components/FeaturedLocationsSection";
import { Footer } from "../components/Footer";
import { HeaderNav } from "../components/HeaderNav";
import { HeroSection } from "../components/HeroSection";
import { MainFeaturesSection } from "../components/MainFeaturesSection";
import { MobileAppSection } from "../components/MobileAppSection";
import { SafetySection } from "../components/SafetySection";
import { SearchPanelSection } from "../components/SearchPanelSection";
import type { LandingPageProps } from "../types";

export const LandingPage: React.FC<LandingPageProps> = ({
	onNavigateToLogin,
	onNavigateToRegister,
}) => {
	return (
		<div className="min-h-screen bg-[#f4f7f2] px-5 py-6 font-sans text-[#10221b] antialiased">
			<div className="mx-auto max-w-[1240px]">
				<HeaderNav
					onNavigateToLogin={onNavigateToLogin}
					onNavigateToRegister={onNavigateToRegister}
				/>
				<HeroSection />
				<SearchPanelSection />
				<FeaturedLocationsSection />
				<MainFeaturesSection />
				<SafetySection />
				<AiAssistantSection />
				<MobileAppSection />
				<Footer />
			</div>
		</div>
	);
};
