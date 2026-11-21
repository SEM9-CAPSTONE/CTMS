import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { LEVEL_QUERY_STALE_TIME } from "../constants";
import { porterLevelsService as api } from "../services/porter-levels.service";
import type {
	DecideGlobalLevelInput,
	DecideLevelInput,
	LevelDefinition,
	PorterLevel,
} from "../types";

const options = { staleTime: LEVEL_QUERY_STALE_TIME, refetchOnWindowFocus: false };
export function useAdminPorterLevels(
	page: number,
	id: string | null,
	level: PorterLevel,
	search = ""
) {
	const client = useQueryClient();
	const policies = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.policies,
		queryFn: api.policies,
	});
	const qualifications = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.qualifications(page, search),
		queryFn: () => api.qualifications(page, search),
	});
	const comparison = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.comparison(id, level),
		enabled: Boolean(id),
		queryFn: () => api.comparison(id as string, level),
	});
	const history = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.history(id),
		enabled: Boolean(id),
		queryFn: () => api.history(id as string),
	});
	const savePolicy = useMutation({
		mutationFn: (payload: LevelDefinition & { expectedVersion: number }) =>
			api.savePolicy(level, payload),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: queryKeys.porterLevels.all });
		},
	});
	const decide = useMutation({
		mutationFn: (payload: DecideLevelInput) => api.decide(id as string, payload),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: queryKeys.porterLevels.all });
			await client.invalidateQueries({ queryKey: queryKeys.porter.routeQualifications });
		},
	});
	return { policies, qualifications, comparison, history, savePolicy, decide };
}

export function useMyPorterLevels() {
	const client = useQueryClient();
	const userId = getStoredAuthUser()?.id ?? "";
	const policies = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.myPolicies,
		queryFn: api.myPolicies,
	});
	const evidence = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.myEvidence(userId),
		queryFn: api.myEvidence,
	});
	const history = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.myHistory(userId),
		queryFn: api.myHistory,
	});
	const save = useMutation({
		mutationFn: (payload: { skills: string[]; expectedVersion: number }) =>
			api.saveEvidence(payload),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: queryKeys.porterLevels.myEvidence(userId) });
		},
	});
	return { policies, evidence, history, save };
}

export function useMyGlobalPorterLevel() {
	const userId = getStoredAuthUser()?.id ?? "";
	return useQuery({
		...options,
		queryKey: queryKeys.porterLevels.myOverview(userId),
		enabled: Boolean(userId),
		queryFn: api.myOverview,
	});
}

export function useAdminGlobalPorterLevels(
	page: number,
	search: string,
	selectedPorterId: string | null
) {
	const client = useQueryClient();

	const list = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.globalPorters(page, search),
		queryFn: () => api.globalPorters(page, search),
	});

	const detail = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.globalPorterOverview(selectedPorterId),
		enabled: Boolean(selectedPorterId),
		queryFn: () => api.globalPorterOverview(selectedPorterId as string),
	});

	const decideGlobal = useMutation({
		mutationFn: ({ porterId, payload }: { porterId: string; payload: DecideGlobalLevelInput }) =>
			api.decideGlobalLevel(porterId, payload),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: queryKeys.porterLevels.all });
		},
	});

	const notifyGaps = useMutation({
		mutationFn: ({ porterId, customNote }: { porterId: string; customNote?: string }) =>
			api.notifyPorterGaps(porterId, customNote),
		onSuccess: async () => {
			await client.invalidateQueries({ queryKey: queryKeys.porterLevels.all });
		},
	});

	return { list, detail, decideGlobal, notifyGaps };
}
