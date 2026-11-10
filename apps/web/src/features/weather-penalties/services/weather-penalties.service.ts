import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminPenaltyFilter,
	MyWeatherPenalties,
	UploadedEvidence,
	WaiverRequestInput,
	WaiverReviewInput,
	WeatherPenalty,
} from "../types";

const EVIDENCE_FOLDER = "weather-penalty-waivers";

export const weatherPenaltiesService = {
	listMine: () => httpClient.get<MyWeatherPenalties>(API_ENDPOINTS.WEATHER.MY_PENALTIES),
	requestWaiver: (penaltyId: string, input: WaiverRequestInput) =>
		httpClient.post<WeatherPenalty>(API_ENDPOINTS.WEATHER.PENALTY_WAIVER_REQUEST(penaltyId), input),
	uploadEvidence: (file: File) => {
		const formData = new FormData();
		formData.append("file", file);
		return httpClient.post<UploadedEvidence>(
			`${API_ENDPOINTS.UPLOADS.DOCUMENT}?folder=${EVIDENCE_FOLDER}`,
			formData
		);
	},
	listForAdmin: (filter: AdminPenaltyFilter) =>
		httpClient.get<WeatherPenalty[]>(
			filter === "all"
				? API_ENDPOINTS.WEATHER.ADMIN_PENALTIES
				: `${API_ENDPOINTS.WEATHER.ADMIN_PENALTIES}?status=${filter}`
		),
	getForAdmin: (penaltyId: string) =>
		httpClient.get<WeatherPenalty>(API_ENDPOINTS.WEATHER.ADMIN_PENALTY(penaltyId)),
	reviewWaiver: (penaltyId: string, input: WaiverReviewInput) =>
		httpClient.post<WeatherPenalty>(API_ENDPOINTS.WEATHER.ADMIN_PENALTY_REVIEW(penaltyId), input),
};
