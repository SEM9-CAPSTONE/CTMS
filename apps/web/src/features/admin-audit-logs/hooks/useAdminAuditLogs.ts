import { useCallback, useEffect, useState } from "react";
import { DEFAULT_AUDIT_LOGS_LIMIT, DEFAULT_AUDIT_LOGS_PAGE } from "../constants";
import { adminAuditLogsService } from "../services/admin-audit-logs.service";
import type { AuditLogListParams, AuditLogSummary } from "../types";
import { mapAdminAuditLogsError } from "../utils/admin-audit-logs.utils";

export function useAdminAuditLogs() {
	const [params, setParams] = useState<AuditLogListParams>({
		page: DEFAULT_AUDIT_LOGS_PAGE,
		limit: DEFAULT_AUDIT_LOGS_LIMIT,
	});

	const [actorInput, setActorInput] = useState("");
	const [actionInput, setActionInput] = useState("");
	const [targetInput, setTargetInput] = useState("");
	const [targetTypeInput, setTargetTypeInput] = useState("");
	const [outcomeInput, setOutcomeInput] = useState<"success" | "failure" | "">("");
	const [startDateInput, setStartDateInput] = useState("");
	const [endDateInput, setEndDateInput] = useState("");

	const [logs, setLogs] = useState<AuditLogSummary[]>([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: DEFAULT_AUDIT_LOGS_LIMIT,
		total: 0,
		totalPages: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const [detailOpen, setDetailOpen] = useState(false);
	const [detailLog, setDetailLog] = useState<AuditLogSummary | null>(null);

	const loadLogs = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const result = await adminAuditLogsService.getAuditLogs(params);
			setLogs(result.items);
			setPagination(result.pagination);
		} catch (error) {
			setErrorMessage(mapAdminAuditLogsError(error));
		} finally {
			setIsLoading(false);
		}
	}, [params]);

	useEffect(() => {
		void loadLogs();
	}, [loadLogs]);

	const submitFilters = () => {
		setParams((current) => ({
			...current,
			actor: actorInput.trim() || undefined,
			action: actionInput.trim() || undefined,
			target: targetInput.trim() || undefined,
			targetType: targetTypeInput.trim() || undefined,
			outcome: outcomeInput || undefined,
			startDate: startDateInput || undefined,
			endDate: endDateInput || undefined,
			page: 1,
		}));
	};

	const resetFilters = () => {
		setActorInput("");
		setActionInput("");
		setTargetInput("");
		setTargetTypeInput("");
		setOutcomeInput("");
		setStartDateInput("");
		setEndDateInput("");
		setParams({
			page: 1,
			limit: DEFAULT_AUDIT_LOGS_LIMIT,
		});
	};

	const setPage = (page: number) => {
		setParams((current) => ({ ...current, page }));
	};

	const viewLog = (log: AuditLogSummary) => {
		setDetailLog(log);
		setDetailOpen(true);
	};

	const closeDetail = () => {
		setDetailOpen(false);
		setDetailLog(null);
	};

	return {
		params,
		actorInput,
		actionInput,
		targetInput,
		targetTypeInput,
		outcomeInput,
		startDateInput,
		endDateInput,
		logs,
		pagination,
		isLoading,
		errorMessage,
		detailOpen,
		detailLog,
		setActorInput,
		setActionInput,
		setTargetInput,
		setTargetTypeInput,
		setOutcomeInput,
		setStartDateInput,
		setEndDateInput,
		submitFilters,
		resetFilters,
		setPage,
		viewLog,
		closeDetail,
		reload: loadLogs,
	};
}
