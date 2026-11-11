import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "../../../shared/components";
import { reportActions } from "../constants";
import { contentReportsService } from "../services/content-reports.service";
import type { ContentReport, ReportError, ReportStatus } from "../types";
import { reportError } from "../utils/report-errors";

export function useReportDetails(reloadQueue: () => Promise<void>) {
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [report, setReport] = useState<ContentReport | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<ReportError | null>(null);
	const [actionError, setActionError] = useState<ReportError | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const sequence = useRef(0);
	const inFlight = useRef(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
			sequence.current += 1;
		};
	}, []);
	const load = useCallback(async (id: string) => {
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		setReport(null);
		try {
			const next = await contentReportsService.detail(id);
			if (request === sequence.current) setReport(next);
		} catch (failure) {
			if (request === sequence.current) setError(reportError(failure));
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, []);
	const open = (id: string) => {
		if (inFlight.current) return;
		setSelectedId(id);
		setActionError(null);
		setSuccess(null);
		void load(id);
	};
	const close = () => {
		if (inFlight.current) return;
		sequence.current++;
		setSelectedId(null);
		setReport(null);
		setActionError(null);
		setSuccess(null);
	};
	const submit = async (status: ReportStatus) => {
		if (
			inFlight.current ||
			loading ||
			!report ||
			!reportActions(report.status).some((action) => action.status === status)
		)
			return;
		inFlight.current = true;
		setSubmitting(true);
		setActionError(null);
		setSuccess(null);
		try {
			const saved = await contentReportsService.transition(report.id, {
				expectedStatus: report.status,
				status,
			});
			if (!mounted.current) return;
			setReport(saved);
			const message = "Đã cập nhật trạng thái báo cáo.";
			setSuccess(message);
			toast.success(message, "Báo cáo nội dung");
			await Promise.all([reloadQueue(), load(report.id)]);
		} catch (failure) {
			if (!mounted.current) return;
			const mapped = reportError(failure);
			setActionError(mapped);
			if (mapped.status === 409) await Promise.all([reloadQueue(), load(report.id)]);
			if (mapped.status === 403 || mapped.status === 404 || mapped.status === 401) {
				setReport(null);
				setError(mapped);
				setActionError(null);
			}
		} finally {
			inFlight.current = false;
			if (mounted.current) setSubmitting(false);
		}
	};
	return {
		selectedId,
		report,
		loading,
		error,
		actionError,
		success,
		submitting,
		open,
		close,
		submit,
		reload: () => (selectedId ? load(selectedId) : Promise.resolve()),
	};
}
