export interface NavItem {
	label: string;
	href: string;
}

export interface DestinationCard {
	title: string;
	location: string;
	price: string;
	rating: number;
	weatherBadge: string;
	statusBadge: string;
	image: string;
}

export interface FeatureItem {
	iconName: string;
	title: string;
	description: string;
}

export interface ChatMessage {
	id?: string;
	sender: "user" | "ai";
	text: string;
}

export interface LandingPageProps {
	onNavigateToLogin: () => void;
	onNavigateToRegister: () => void;
}
