import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	DecideLevelInput,
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
	qualifications: (page: number) =>
		httpClient.get<{ items: LevelQualification[]; total: number }>(API.QUALIFICATIONS, {
			page,
			limit: 20,
		}),
	comparison: (id: string, level: PorterLevel) =>
		httpClient.get<ReviewContext>(API.COMPARISON(id, level)),
	decide: (id: string, payload: DecideLevelInput) =>
		httpClient.post<LevelDecision>(API.DECISIONS(id), payload),
	history: (id: string) => httpClient.get<LevelDecision[]>(API.HISTORY(id)),
	myPolicies: () => httpClient.get<LevelPolicy[]>(API.MY_POLICIES),
	myEvidence: () => httpClient.get<LevelEvidence>(API.MY_SKILLS),
	saveEvidence: (payload: { skills: string[]; expectedVersion: number }) =>
		httpClient.put<LevelEvidence>(API.MY_SKILLS, payload),
	myHistory: () => httpClient.get<LevelDecision[]>(API.MY_HISTORY),
};
