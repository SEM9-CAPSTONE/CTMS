import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { LEVEL_QUERY_STALE_TIME } from "../constants";
import type {
	CreateRequestInput,
	RequestEvidence,
	RequestFilters,
	RequestReviewInput,
} from "../request-types";
import { levelRequestsService as api } from "../services/level-requests.service";

const POLL_INTERVAL = 15_000;
export function useLevelRequests(admin: boolean, filters: RequestFilters, id: string | null) {
	const userId = getStoredAuthUser()?.id ?? "";
	const client = useQueryClient();
	const options = { staleTime: LEVEL_QUERY_STALE_TIME, refetchOnWindowFocus: false };
	const list = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.requests(userId, admin, filters),
		queryFn: () => api.list(admin, filters),
		refetchInterval: POLL_INTERVAL,
	});
	const detail = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.request(userId, admin, id),
		enabled: Boolean(id),
		queryFn: () => api.detail(admin, id as string),
		refetchOnMount: "always",
	});
	const qualifications = useQuery({
		...options,
		queryKey: queryKeys.porterLevels.myQualifications(userId),
		enabled: !admin,
		queryFn: api.qualifications,
	});
	const refresh = async () => {
		await client.invalidateQueries({ queryKey: queryKeys.porterLevels.all });
	};
	const create = useMutation({
		mutationFn: (input: CreateRequestInput) => api.create(input),
		onSuccess: refresh,
	});
	const review = useMutation({
		mutationFn: (input: RequestReviewInput) => api.review(id as string, input),
		onSuccess: refresh,
	});
	const cancel = useMutation({
		mutationFn: (version: number) => api.cancel(id as string, version),
		onSuccess: refresh,
	});
	const resubmit = useMutation({
		mutationFn: (input: { version: number; reason: string }) =>
			api.resubmit(id as string, input.version, input.reason),
		onSuccess: refresh,
	});
	const add = useMutation({
		mutationFn: (input: { version: number; files: File[] }) =>
			api.addEvidence(id as string, input.version, input.files),
		onSuccess: refresh,
	});
	const remove = useMutation({
		mutationFn: (input: { version: number; fileId: string }) =>
			api.removeEvidence(id as string, input.fileId, input.version),
		onSuccess: refresh,
	});
	const download = useMutation({
		mutationFn: async (file: RequestEvidence) => {
			const blob = await api.download(admin, id as string, file);
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = file.fileName;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		},
	});
	return { list, detail, qualifications, create, review, cancel, resubmit, add, remove, download };
}
export function useLevelNotifications() {
	const userId = getStoredAuthUser()?.id ?? "";
	const client = useQueryClient();
	const query = useQuery({
		queryKey: queryKeys.porterLevels.notifications(userId),
		queryFn: api.notifications,
		refetchInterval: POLL_INTERVAL,
		staleTime: POLL_INTERVAL,
	});
	const read = useMutation({
		mutationFn: api.readNotification,
		onSuccess: () =>
			client.invalidateQueries({ queryKey: queryKeys.porterLevels.notifications(userId) }),
	});
	return { query, read };
}
