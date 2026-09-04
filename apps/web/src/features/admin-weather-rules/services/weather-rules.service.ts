import { API_ENDPOINTS } from "../../../core/api/endpoints";
import { httpClient } from "../../../core/api/httpClient";
import type { CreateWeatherRiskRulePayload, WeatherRiskRuleItem } from "../types";

export const weatherRulesService = {
	getAll: async (): Promise<WeatherRiskRuleItem[]> => {
		return httpClient.get<WeatherRiskRuleItem[]>(API_ENDPOINTS.WEATHER.RULES_LIST);
	},

	getActive: async (): Promise<WeatherRiskRuleItem | null> => {
		try {
			return await httpClient.get<WeatherRiskRuleItem | null>(API_ENDPOINTS.WEATHER.RULES_ACTIVE);
		} catch {
			return null;
		}
	},

	getById: async (id: string): Promise<WeatherRiskRuleItem> => {
		return httpClient.get<WeatherRiskRuleItem>(API_ENDPOINTS.WEATHER.RULES_BY_ID(id));
	},

	createRule: async (payload: CreateWeatherRiskRulePayload): Promise<WeatherRiskRuleItem> => {
		return httpClient.post<WeatherRiskRuleItem>(API_ENDPOINTS.WEATHER.RULES_CREATE, payload);
	},

	activateRule: async (id: string): Promise<WeatherRiskRuleItem> => {
		return httpClient.patch<WeatherRiskRuleItem>(API_ENDPOINTS.WEATHER.RULES_ACTIVATE(id));
	},
};
