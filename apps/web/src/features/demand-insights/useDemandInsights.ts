import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { HttpError } from "../../core/api/httpClient";
import { queryKeys } from "../../core/api/queryKeys";
import { activeStatus, formatDate } from "./constants";
import { demandService } from "./service";

export function demandError(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 401 || error.status === 403) return "Bạn không có quyền xem trang này.";
		if (error.status === 422) {
			const body = error.errorData;
			if (
				body &&
				typeof body === "object" &&
				"code" in body &&
				body.code === "period_not_settled" &&
				"availableAt" in body &&
				typeof body.availableAt === "string" &&
				Number.isFinite(Date.parse(body.availableAt))
			)
				return `Báo cáo tháng này sẽ tạo được từ ${formatDate(body.availableAt)}.`;
			return "Kỳ này chưa được phép tạo báo cáo hoặc không còn hợp lệ. Vui lòng tải lại danh sách kỳ.";
		}
		if (error.status === 429) return "Vui lòng chờ trước khi tạo báo cáo tiếp theo.";
	}
	return "Chưa thể kết nối. Vui lòng thử lại sau.";
}
export function useDemandInsights(actor: string, selected: string) {
	const client = useQueryClient();
	const [visible, setVisible] = useState(() => !document.hidden);
	const [waitUntil, setWaitUntil] = useState(0);
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
			setNow(Date.now());
			if (Date.now() >= waitUntil) window.clearInterval(timer);
		}, 1000);
		return () => window.clearInterval(timer);
	}, [waitUntil]);
	const periods = useQuery({
		queryKey: queryKeys.demandInsights.periods(actor),
		queryFn: ({ signal }) => demandService.periods(signal),
		enabled: !!actor && visible,
		retry: false,
		staleTime: 0,
		gcTime: 0,
	});
	const month =
		selected ||
		periods.data?.periods.find((period) => period.hasReport)?.month ||
		periods.data?.periods.find((period) => period.canCreate)?.month ||
		"";
	const report = useQuery({
		queryKey: queryKeys.demandInsights.report(actor, month),
		queryFn: async ({ signal }) => {
			try {
				const result = await demandService.report(month, signal);
				failures.current = { month, count: 0 };
				return result;
			} catch (error) {
				if (!signal.aborted)
					failures.current = {
						month,
						count: failures.current.month === month ? failures.current.count + 1 : 1,
					};
				throw error;
			}
		},
		enabled: !!actor && !!month && visible,
		retry: false,
		staleTime: 0,
		gcTime: 0,
		refetchOnWindowFocus: false,
		refetchInterval: (query) => {
			if (!visible || !activeStatus(query.state.data?.status)) return false;
			if (
				query.state.error instanceof HttpError &&
				[401, 403, 404, 422].includes(query.state.error.status)
			)
				return false;
			return Math.min(
				60000,
				5000 * 2 ** Math.min(failures.current.month === month ? failures.current.count : 0, 4)
			);
		},
	});
	const create = useMutation({
		mutationFn: (selected: string) => demandService.create(selected),
		onSuccess: (_data, selected) => {
			void client.invalidateQueries({ queryKey: queryKeys.demandInsights.report(actor, selected) });
			void client.invalidateQueries({ queryKey: queryKeys.demandInsights.periods(actor) });
		},
		onError: (error) => {
			if (error instanceof HttpError && error.status === 429) {
				const seconds = Number(error.headers.get("Retry-After"));
				const body = error.errorData;
				const fallback =
					body && typeof body === "object" && "retryAfterSeconds" in body
						? Number(body.retryAfterSeconds)
						: 60;
				setWaitUntil(
					Date.now() +
						(Number.isFinite(seconds) && seconds > 0
							? seconds
							: Number.isFinite(fallback) && fallback > 0
								? fallback
								: 60) *
							1000
				);
				setNow(Date.now());
			}
			if (error instanceof HttpError && error.status === 422) void periods.refetch();
		},
		onSettled: () => {
			submitting.current = false;
		},
	});
	return {
		month,
		periods,
		report,
		create,
		waitSeconds: Math.max(0, Math.ceil((waitUntil - now) / 1000)),
		submit: () => {
			if (submitting.current || !month) return;
			submitting.current = true;
			create.mutate(month);
		},
	};
}
