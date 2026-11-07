import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { queryKeys } from "../../core/api/queryKeys";
import { activeStatus } from "./constants";
import { demandService } from "./service";
import type { DemandPlanningStatus } from "./types";

let globalPlanningWaitUntil = 0;

export function planningError(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 401 || error.status === 403) {
			return "Bạn không có quyền xem thông tin này.";
		}
		if (error.status === 422) {
			const body = error.errorData;
			if (body && typeof body === "object" && "code" in body) {
				if (body.code === "planning_unavailable") {
					return "Chưa hỗ trợ gợi ý tổ chức chuyến cho kỳ báo cáo này.";
				}
				if (body.code === "context_stale") {
					return "Dữ liệu kỳ này đã thay đổi, không thể tạo gợi ý mới.";
				}
				if (body.code === "report_not_ready") {
					return "Báo cáo tháng chưa hoàn tất.";
				}
			}
			return "Kỳ này chưa đủ điều kiện tạo gợi ý tổ chức chuyến.";
		}
		if (error.status === 429) {
			return "Vui lòng chờ trước khi yêu cầu gợi ý tiếp theo.";
		}
	}
	return "Chưa thể kết nối. Vui lòng thử lại sau.";
}

export function parseRetryAfter(error: unknown): number {
	if (error instanceof HttpError && error.status === 429) {
		const headerVal = Number(error.headers.get("Retry-After"));
		if (Number.isFinite(headerVal) && headerVal > 0) {
			return headerVal;
		}
		const body = error.errorData;
		if (body && typeof body === "object" && "retryAfterSeconds" in body) {
			const bodyVal = Number(body.retryAfterSeconds);
			if (Number.isFinite(bodyVal) && bodyVal > 0) {
				return bodyVal;
			}
		}
		return 60;
	}
	return 60;
}

export function useDemandPlanning(actor: string, month: string, isReportSucceeded: boolean) {
	const client = useQueryClient();
	const [visible, setVisible] = useState(() => !document.hidden);
	const [waitUntil, setWaitUntil] = useState(() => globalPlanningWaitUntil);
	const [now, setNow] = useState(Date.now);
	const submitting = useRef(false);
	const failures = useRef({ month: "", count: 0 });

	useEffect(() => {
		const change = () => setVisible(!document.hidden);
		document.addEventListener("visibilitychange", change);
		return () => document.removeEventListener("visibilitychange", change);
	}, []);

	useEffect(() => {
		if (waitUntil <= Date.now()) return;
		const timer = window.setInterval(() => {
			const current = Date.now();
			setNow(current);
			if (current >= waitUntil) {
				window.clearInterval(timer);
			}
		}, 1000);
		return () => window.clearInterval(timer);
	}, [waitUntil]);

	useEffect(() => {
		failures.current = { month, count: 0 };
	}, [month]);

	const planning = useQuery({
		queryKey: queryKeys.demandInsights.planning(actor, month),
		queryFn: async ({ signal }) => {
			try {
				const result = await demandService.planning(month, signal);
				failures.current = { month, count: 0 };
				return result;
			} catch (error) {
				if (!signal.aborted) {
					failures.current = {
						month,
						count: failures.current.month === month ? failures.current.count + 1 : 1,
					};
				}
				throw error;
			}
		},
		enabled: !!actor && !!month && isReportSucceeded && visible,
		retry: false,
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		refetchInterval: (query) => {
			if (!visible) return false;
			const currentStatus = query.state.data?.status;
			if (!activeStatus(currentStatus)) return false;
			// Stop on non-retryable errors (401, 403, 404, 422)
			if (
				query.state.error instanceof HttpError &&
				[401, 403, 404, 422].includes(query.state.error.status)
			) {
				return false;
			}
			// Bounded backoff for network/server errors
			return Math.min(
				60000,
				5000 * 2 ** Math.min(failures.current.month === month ? failures.current.count : 0, 4)
			);
		},
	});

	const create = useMutation({
		mutationFn: (targetMonth: string) => demandService.createPlanning(targetMonth),
		onSuccess: (_data, targetMonth) => {
			void client.invalidateQueries({
				queryKey: queryKeys.demandInsights.planning(actor, targetMonth),
			});
		},
		onError: (error) => {
			if (error instanceof HttpError && error.status === 429) {
				const wait = parseRetryAfter(error);
				const target = Date.now() + wait * 1000;
				globalPlanningWaitUntil = target;
				setWaitUntil(target);
				setNow(Date.now());
			}
		},
		onSettled: () => {
			submitting.current = false;
		},
	});

	const rawStatus: DemandPlanningStatus | undefined = planning.data?.status;
	const isAvailable = isReportSucceeded && !planning.isError && rawStatus === "not_requested";

	const submit = () => {
		if (
			submitting.current ||
			!month ||
			!isAvailable ||
			waitUntil > Date.now() ||
			create.isPending
		) {
			return;
		}
		submitting.current = true;
		create.mutate(month);
	};

	return {
		month,
		planning,
		create,
		data: planning.data,
		status: rawStatus,
		isAvailable,
		isSubmitting: create.isPending || submitting.current,
		waitSeconds: Math.max(0, Math.ceil((waitUntil - now) / 1000)),
		submit,
		refetch: () => planning.refetch(),
	};
}
