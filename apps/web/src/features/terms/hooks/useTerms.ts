import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { TERMS_STALE_TIME_MS, TERMS_STATUS_STALE_TIME_MS } from "../constants";
import { termsService } from "../services/terms.service";
import type {
	AcceptTermsPayload,
	CreateTermsVersionPayload,
	UpdateTermsVersionPayload,
} from "../types";

export function useCurrentTerms() {
	return useQuery({
		queryKey: queryKeys.terms.current,
		queryFn: () => termsService.getCurrent(),
		staleTime: TERMS_STALE_TIME_MS,
	});
}

export function useTermsVersions(enabled: boolean) {
	return useQuery({
		queryKey: queryKeys.terms.versions,
		queryFn: () => termsService.listVersions(),
		enabled,
		staleTime: TERMS_STALE_TIME_MS,
	});
}

export function useTermsVersionDetail(version: string | null) {
	return useQuery({
		queryKey: queryKeys.terms.version(version ?? "current"),
		queryFn: () => (version ? termsService.getVersionByCode(version) : termsService.getCurrent()),
		enabled: Boolean(version),
		staleTime: TERMS_STALE_TIME_MS,
	});
}

export function useMyTermsStatus(userId: string | null) {
	return useQuery({
		queryKey: queryKeys.terms.myStatus(userId ?? "anonymous"),
		queryFn: () => termsService.getMyStatus(),
		enabled: Boolean(userId),
		staleTime: TERMS_STATUS_STALE_TIME_MS,
		retry: false,
	});
}

export function useAcceptTerms(userId: string | null) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: AcceptTermsPayload) => termsService.acceptTerms(payload),
		onSuccess: () => {
			if (userId) {
				void queryClient.invalidateQueries({ queryKey: queryKeys.terms.myStatus(userId) });
			}
			void queryClient.invalidateQueries({ queryKey: queryKeys.terms.current });
		},
	});
}

export function usePublishTermsVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (payload: CreateTermsVersionPayload) => termsService.publishVersion(payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.terms.all });
		},
	});
}

export function useUpdateTermsVersion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, payload }: { id: string; payload: UpdateTermsVersionPayload }) =>
			termsService.updateVersion(id, payload),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.terms.all });
		},
	});
}
