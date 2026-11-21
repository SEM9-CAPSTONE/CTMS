import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { queryKeys } from "../../../core/api/queryKeys";
import { toast } from "../../../shared/components/Toast";
import { saveQuickCreatePrefill } from "../../trips/utils/quick-create-prefill";
import { HOST_SUGGESTIONS_POLL_INTERVAL_MS } from "../constants";
import { hostAnalyticsService } from "../services/host-analytics.service";
import type {
	ActiveSuggestionJobConflict,
	HostAnalyticsFilterParams,
	HostSuggestionHistoryItem,
	HostSuggestionJobResponse,
} from "../types";

function extractHttpPayload(error: unknown): Record<string, unknown> | null {
	if (!(error instanceof HttpError)) return null;
	if (error.errorData && typeof error.errorData === "object") {
		return error.errorData as Record<string, unknown>;
	}
	return null;
}

function parseRetryAfterSeconds(error: unknown): number {
	const payload = extractHttpPayload(error);
	if (payload && typeof payload.retryAfterSeconds === "number" && payload.retryAfterSeconds > 0) {
		return Math.ceil(payload.retryAfterSeconds);
	}
	if (error instanceof HttpError && error.headers) {
		const raw = error.headers.get("retry-after");
		const parsed = raw ? Number(raw) : Number.NaN;
		if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed);
	}
	return 60;
}

function mapQuickCreateErrorMessage(error: unknown): string {
	const payload = extractHttpPayload(error);
	const code = typeof payload?.error === "string" ? payload.error : "";
	switch (code) {
		case "route_not_active":
			return "Tuyến trekking của gợi ý này hiện không còn ở trạng thái đang hoạt động.";
		case "route_not_owned":
			return "Tuyến trekking không còn thuộc quyền quản lý của bạn.";
		case "area_inactive":
			return "Khu vực của gợi ý này hiện không còn hoạt động.";
		case "SUGGESTION_NOT_FOUND":
			return "Không tìm thấy gợi ý chuyến đi này.";
		default:
			return "Không thể tải thông tin tạo chuyến nhanh. Vui lòng thử lại.";
	}
}

export function useHostSuggestions(actor: string, onNavigateCreateTrip: (path: string) => void) {
	const queryClient = useQueryClient();
	const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
	const [waitSeconds, setWaitSeconds] = useState(0);
	const [activeConflict, setActiveConflict] = useState<ActiveSuggestionJobConflict | null>(null);
	const [quickCreateBusyId, setQuickCreateBusyId] = useState<string | null>(null);
	const [isTabVisible, setIsTabVisible] = useState(() =>
		typeof document === "undefined" ? true : !document.hidden
	);

	// Track browser tab visibility so polling pauses when tab is hidden
	useEffect(() => {
		if (typeof document === "undefined") return;
		const onVisibilityChange = () => setIsTabVisible(!document.hidden);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => document.removeEventListener("visibilitychange", onVisibilityChange);
	}, []);

	// Cooldown countdown timer for HTTP 429
	useEffect(() => {
		if (waitSeconds <= 0) return;
		const timer = setInterval(() => {
			setWaitSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
		}, 1000);
		return () => clearInterval(timer);
	}, [waitSeconds]);

	// On mount: ONLY GET /latest (never auto-POST)
	const latestQuery = useQuery<HostSuggestionJobResponse | null>({
		queryKey: queryKeys.hostAnalytics.latestSuggestion(actor),
		queryFn: async () => {
			try {
				return await hostAnalyticsService.getLatestSuggestionJob();
			} catch (error) {
				if (error instanceof HttpError && error.status === 404) {
					return null;
				}
				throw error;
			}
		},
		enabled: Boolean(actor),
		retry: false,
		refetchInterval: (query) => {
			if (!isTabVisible || trackedJobId) return false;
			const status = query.state.data?.status;
			return status === "queued" || status === "running"
				? HOST_SUGGESTIONS_POLL_INTERVAL_MS
				: false;
		},
	});

	const trackedQuery = useQuery<HostSuggestionJobResponse>({
		queryKey: queryKeys.hostAnalytics.suggestionJob(actor, trackedJobId ?? ""),
		queryFn: () => hostAnalyticsService.getSuggestionJobById(trackedJobId as string),
		enabled: Boolean(actor && trackedJobId),
		retry: false,
		refetchInterval: (query) => {
			if (!isTabVisible) return false;
			const status = query.state.data?.status;
			return status === "queued" || status === "running"
				? HOST_SUGGESTIONS_POLL_INTERVAL_MS
				: false;
		},
	});

	const historyQuery = useQuery<HostSuggestionHistoryItem[]>({
		queryKey: queryKeys.hostAnalytics.suggestionHistory(actor),
		queryFn: () => hostAnalyticsService.getSuggestionHistory(),
		enabled: Boolean(actor),
		retry: false,
	});

	// Sync completed tracked job back into latest cache
	useEffect(() => {
		if (!trackedQuery.data) return;
		if (trackedQuery.data.status === "succeeded" || trackedQuery.data.status === "failed") {
			queryClient.setQueryData(queryKeys.hostAnalytics.latestSuggestion(actor), trackedQuery.data);
			void queryClient.invalidateQueries({
				queryKey: queryKeys.hostAnalytics.suggestionHistory(actor),
			});
			setTrackedJobId(null);
			setActiveConflict(null);
		}
	}, [trackedQuery.data, actor, queryClient]);

	const activeJob: HostSuggestionJobResponse | null = trackedQuery.data ?? latestQuery.data ?? null;

	const createMutation = useMutation({
		mutationFn: (params: HostAnalyticsFilterParams) =>
			hostAnalyticsService.createSuggestionJob(params),
		onSuccess: (job) => {
			setActiveConflict(null);
			queryClient.setQueryData(queryKeys.hostAnalytics.latestSuggestion(actor), job);
			if (job.status === "queued" || job.status === "running") {
				setTrackedJobId(job.id);
				toast.info("Đang tổng hợp gợi ý chuyến đi từ lịch sử của bạn.");
			} else if (job.status === "succeeded") {
				toast.success("Đã tải lại gợi ý chuyến đi phù hợp với dữ liệu hiện tại.");
			}
		},
		onError: (error) => {
			if (error instanceof HttpError && error.status === 429) {
				const retryAfter = parseRetryAfterSeconds(error);
				setWaitSeconds(retryAfter);
				const payload = extractHttpPayload(error);
				const code = typeof payload?.error === "string" ? payload.error : "";
				if (code === "daily_quota_exceeded") {
					toast.error("Bạn đã dùng hết hạn mức tạo gợi ý trong ngày hôm nay.");
				} else {
					toast.error(`Vui lòng chờ ${retryAfter} giây trước khi tạo gợi ý mới.`);
				}
				return;
			}

			if (error instanceof HttpError && error.status === 409) {
				const payload = extractHttpPayload(error);
				if (payload?.error === "active_job_different_params" && payload.activeJob) {
					setActiveConflict(payload.activeJob as ActiveSuggestionJobConflict);
					toast.error("Bạn đang có một yêu cầu tạo gợi ý khác đang xử lý.");
					return;
				}
			}

			if (error instanceof HttpError && error.status === 422) {
				toast.error("Chưa có tuyến đang hoạt động phù hợp để tạo gợi ý chuyến đi.");
				return;
			}

			toast.error("Không thể tạo yêu cầu gợi ý lúc này. Vui lòng thử lại sau.");
		},
	});

	const openQuickCreate = useCallback(
		async (suggestionId: string) => {
			if (!actor || quickCreateBusyId) return;
			setQuickCreateBusyId(suggestionId);
			try {
				const ctx = await hostAnalyticsService.getQuickCreateContext(suggestionId);
				saveQuickCreatePrefill(actor, suggestionId, ctx.prefill);
				onNavigateCreateTrip("/host/trips/create?from=host-analytics");
			} catch (error) {
				toast.error(mapQuickCreateErrorMessage(error));
			} finally {
				setQuickCreateBusyId(null);
			}
		},
		[actor, quickCreateBusyId, onNavigateCreateTrip]
	);

	return {
		job: activeJob,
		history: historyQuery.data ?? [],
		isLoading: latestQuery.isPending,
		isPolling: activeJob?.status === "queued" || activeJob?.status === "running",
		isCreating: createMutation.isPending,
		waitSeconds,
		activeConflict,
		quickCreateBusyId,
		createJob: createMutation.mutate,
		inspectConflictJob: (jobId: string) => {
			setTrackedJobId(jobId);
			setActiveConflict(null);
		},
		openQuickCreate,
	};
}
