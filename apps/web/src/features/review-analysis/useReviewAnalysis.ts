import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { queryKeys } from "../../core/api/queryKeys";
import { ANALYSIS_PAGE_SIZE, isActive } from "./constants";
import { analysisService } from "./service";
import type { InsightResponse, SentimentFilter } from "./types";

export function friendlyError(error: unknown) {
	if (error instanceof HttpError) {
		if (error.status === 401 || error.status === 403)
			return "Bạn không có quyền xem dữ liệu này hoặc phiên đăng nhập đã hết hạn.";
		if (error.status === 404) return "Không tìm thấy chuyến đi hoặc dữ liệu phân tích.";
		if (error.status === 409) return "Đã có lượt phân tích đang xử lý. Đang tải lại tiến độ.";
		if (error.status === 429) return "Vui lòng chờ trước khi tạo lượt phân tích tiếp theo.";
	}
	return "Chưa thể tải dữ liệu. Kiểm tra kết nối và thử lại.";
}
export function useReviewAnalysis(
	actor: string,
	tripId: string,
	page: number,
	sentiment: SentimentFilter = "all"
) {
	const client = useQueryClient();
	const [visible, setVisible] = useState(() => !document.hidden);
	const [now, setNow] = useState(Date.now);
	const [waitUntil, setWaitUntil] = useState(0);
	const [createdBatch, setCreatedBatch] = useState<{ tripId: string; id: string } | null>(null);
	const refreshed = useRef("");
	const submitting = useRef(false);
	const pollFailures = useRef({ batchId: "", count: 0 });
	useEffect(() => {
		const visibility = () => setVisible(!document.hidden);
		document.addEventListener("visibilitychange", visibility);
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => {
			document.removeEventListener("visibilitychange", visibility);
			window.clearInterval(timer);
		};
	}, []);
	const insights = useQuery<InsightResponse>({
		queryKey: [
			...queryKeys.reviewAnalysis.insights(actor, tripId, page),
			ANALYSIS_PAGE_SIZE,
			sentiment,
		],
		placeholderData: (previous, query) =>
			query?.queryKey[1] === actor && query.queryKey[2] === tripId ? previous : undefined,
		queryFn: ({ signal }) => analysisService.insights(tripId, page, signal, sentiment),
		enabled: !!tripId && visible,
		retry: false,
		refetchOnWindowFocus: "always",
	});
	useEffect(() => {
		if (insights.data && !insights.isPlaceholderData)
			setWaitUntil(
				insights.data.retryAfterSeconds > 0
					? insights.dataUpdatedAt + insights.data.retryAfterSeconds * 1000
					: 0
			);
	}, [insights.data, insights.dataUpdatedAt, insights.isPlaceholderData]);
	const batchId =
		createdBatch?.tripId === tripId ? createdBatch.id : (insights.data?.latestBatch?.id ?? "");
	useEffect(() => {
		if (createdBatch?.tripId === tripId && insights.data?.latestBatch?.id === createdBatch.id)
			setCreatedBatch(null);
	}, [createdBatch, tripId, insights.data?.latestBatch?.id]);
	const batch = useQuery({
		queryKey: queryKeys.reviewAnalysis.batch(actor, tripId, batchId),
		queryFn: async ({ signal }) => {
			if (pollFailures.current.batchId !== batchId) pollFailures.current = { batchId, count: 0 };
			try {
				const value = await analysisService.batch(tripId, batchId, signal);
				pollFailures.current.count = 0;
				return value;
			} catch (error) {
				if (!signal.aborted) pollFailures.current.count++;
				throw error;
			}
		},
		enabled: !!tripId && !!batchId && visible && !insights.isError,
		retry: false,
		refetchInterval: (query) =>
			!visible ||
			!isActive(query.state.data?.batch.status ?? insights.data?.latestBatch?.status) ||
			(query.state.error instanceof HttpError && [401, 403, 404].includes(query.state.error.status))
				? false
				: Math.min(15000, 2000 * 2 ** Math.min(pollFailures.current.count, 3)),
		refetchIntervalInBackground: false,
	});
	useEffect(() => {
		const value = batch.data;
		if (!value || isActive(value.batch.status)) return;
		const key = `${tripId}:${value.batch.id}:${value.batch.status}`;
		if (refreshed.current === key) return;
		refreshed.current = key;
		void client.invalidateQueries({ queryKey: ["review-analysis"] });
		void client.invalidateQueries({ queryKey: ["review-analytics"] });
	}, [batch.data, client, tripId]);
	const create = useMutation({
		onSettled: () => {
			submitting.current = false;
		},
		mutationFn: () => analysisService.create(tripId),
		onSuccess: (value) => {
			setCreatedBatch({ tripId, id: value.batch.id });
			if (!value.reused) setWaitUntil(Date.now() + 60000);
			void client.invalidateQueries({ queryKey: ["review-analysis", actor, tripId] });
		},
		onError: (error) => {
			if (error instanceof HttpError && error.status === 429) {
				const data = error.errorData;
				const seconds =
					data &&
					typeof data === "object" &&
					"retryAfterSeconds" in data &&
					typeof data.retryAfterSeconds === "number"
						? data.retryAfterSeconds
						: 60;
				setWaitUntil(Date.now() + Math.max(1, seconds) * 1000);
			}
			if (error instanceof HttpError && error.status === 409) void insights.refetch();
		},
	});
	return {
		submit: () => {
			if (submitting.current) return;
			submitting.current = true;
			create.mutate();
		},
		insights,
		batch,
		create,
		waitSeconds: Math.max(0, Math.ceil((waitUntil - now) / 1000)),
		running: isActive(batch.data?.batch.status ?? insights.data?.latestBatch?.status),
	};
}
