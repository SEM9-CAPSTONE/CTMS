export interface WeatherRiskRuleItem {
	id: string;
	version: number;
	rainfallYellowThreshold: number;
	rainfallRedThreshold: number;
	windYellowThreshold: number;
	windRedThreshold: number;
	tempLowYellow: number;
	tempLowRed: number;
	tempHighYellow: number;
	tempHighRed: number;
	visibilityYellowThreshold: number;
	visibilityRedThreshold: number;
	thunderstormYellow: boolean;
	thunderstormRed: boolean;
	rainfallWeight: number;
	windWeight: number;
	temperatureWeight: number;
	visibilityWeight: number;
	thunderstormWeight: number;
	greenMaxScore: number;
	yellowMaxScore: number;
	isActive: boolean;
	createdBy?: string | null;
	createdAt: string;
}

export interface CreateWeatherRiskRulePayload {
	rainfallYellowThreshold: number;
	rainfallRedThreshold: number;
	windYellowThreshold: number;
	windRedThreshold: number;
	tempLowYellow: number;
	tempLowRed: number;
	tempHighYellow: number;
	tempHighRed: number;
	visibilityYellowThreshold: number;
	visibilityRedThreshold: number;
	thunderstormYellow: boolean;
	thunderstormRed: boolean;
	rainfallWeight: number;
	windWeight: number;
	temperatureWeight: number;
	visibilityWeight: number;
	thunderstormWeight: number;
	greenMaxScore: number;
	yellowMaxScore: number;
	isActive?: boolean;
}
