import { useCallback, useEffect, useRef, useState } from "react";
import { REPORT_PAGE_LIMIT } from "../constants";
import { contentReportsService } from "../services/content-reports.service";
import type { ReportError, ReportQueue } from "../types";
import { reportError } from "../utils/report-errors";

export function useReportQueue() {
	const [page, setPage] = useState(1);
	const [data, setData] = useState<ReportQueue | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<ReportError | null>(null);
	const sequence = useRef(0);
	const reload = useCallback(async () => {
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		setData(null);
		try {
			const next = await contentReportsService.list(page, REPORT_PAGE_LIMIT);
			if (request === sequence.current) setData(next);
		} catch (failure) {
			if (request === sequence.current) setError(reportError(failure));
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, [page]);
	useEffect(() => {
		void reload();
		return () => {
			sequence.current += 1;
		};
	}, [reload]);
	return { data, page, loading, error, reload, setPage };
}
