import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	DecideGlobalLevelInput,
	DecideLevelInput,
	GlobalPorterLevelOverview,
	GlobalPorterSummaryItem,
	LevelDecision,
	LevelDefinition,
	LevelEvidence,
	LevelPolicy,
	LevelQualification,
	PorterLevel,
	ReviewContext,
} from "../types";

const API = API_ENDPOINTS.PORTER_LEVELS;
export const porterLevelsService = {
	policies: () => httpClient.get<LevelPolicy[]>(API.POLICIES),
	savePolicy: (level: PorterLevel, payload: LevelDefinition & { expectedVersion: number }) =>
		httpClient.put<LevelPolicy>(API.POLICY(level), payload),
	qualifications: (page: number, search?: string) =>
		httpClient.get<{ items: LevelQualification[]; total: number }>(API.QUALIFICATIONS, {
			page,
			limit: 20,
			search,
		}),
	comparison: (id: string, level: PorterLevel) =>
		httpClient.get<ReviewContext>(API.COMPARISON(id, level)),
	decide: (id: string, payload: DecideLevelInput) =>
		httpClient.post<LevelDecision>(API.DECISIONS(id), payload),
	history: (id: string) => httpClient.get<LevelDecision[]>(API.HISTORY(id)),
	myPolicies: () => httpClient.get<LevelPolicy[]>(API.MY_POLICIES),
	myOverview: () => httpClient.get<GlobalPorterLevelOverview>(API.MY_OVERVIEW),
	myEvidence: () => httpClient.get<LevelEvidence>(API.MY_SKILLS),
	saveEvidence: (payload: { skills: string[]; expectedVersion: number }) =>
		httpClient.put<LevelEvidence>(API.MY_SKILLS, payload),
	myHistory: () => httpClient.get<LevelDecision[]>(API.MY_HISTORY),
	globalPorters: (page: number, search?: string) =>
		httpClient.get<{ items: GlobalPorterSummaryItem[]; total: number }>(API.GLOBAL_PORTERS, {
			page,
			limit: 5,
			search,
		}),
	globalPorterOverview: (porterId: string) =>
		httpClient.get<GlobalPorterLevelOverview>(API.GLOBAL_PORTER_OVERVIEW(porterId)),
	decideGlobalLevel: (porterId: string, payload: DecideGlobalLevelInput) =>
		httpClient.post<GlobalPorterLevelOverview>(API.GLOBAL_PORTER_DECISION(porterId), payload),
	notifyPorterGaps: (porterId: string, customNote?: string) =>
		httpClient.post<{ sent: true; missingCount: number; message: string }>(
			API.GLOBAL_PORTER_NOTIFY_GAPS(porterId),
			{ customNote: customNote || undefined }
		),
};
