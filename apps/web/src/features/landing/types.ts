export interface NavItem {
	label: string;
	href: string;
}

export interface DestinationCard {
	id?: string;
	title: string;
	location: string;
	zone?: string;
	price: string;
	rating: number;
	reviewCount?: number;
	weatherBadge: string;
	statusBadge: string;
	image: string;
	images?: string[];
	difficulty?: "Dễ" | "Trung bình" | "Thử thách";
	duration?: string;
	distance?: string;
	elevation?: string;
	highlights?: string[];
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
