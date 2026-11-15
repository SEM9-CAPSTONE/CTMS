import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { toast } from "../../../shared/components/Toast";
import { reportsService } from "../services/reports.service";
import type { ReportContext, ReportInput, ReportType } from "../types";
import { descriptionError, reportErrorCode, reportErrorMessage } from "../utils/report-input";

interface Draft {
	description: string;
	reportType: ReportType;
	key?: string;
	fingerprint?: string;
}
const draftKey = (actor: string, target: string) => `ctms:report-draft:${actor}:${target}`;
function restore(actor: string, target: string): Draft {
	try {
		const raw: unknown = JSON.parse(sessionStorage.getItem(draftKey(actor, target)) ?? "null");
		if (
			raw &&
			typeof raw === "object" &&
			"description" in raw &&
			typeof raw.description === "string" &&
			"reportType" in raw &&
			(raw.reportType === "inaccurate_information" || raw.reportType === "dangerous_content")
		) {
			return {
				description: raw.description,
				reportType: raw.reportType,
				key: "key" in raw && typeof raw.key === "string" ? raw.key : undefined,
				fingerprint:
					"fingerprint" in raw && typeof raw.fingerprint === "string" ? raw.fingerprint : undefined,
			};
		}
	} catch {
		/* Storage may be unavailable; keep the current in-memory draft. */
	}
	return { description: "", reportType: "inaccurate_information" };
}
export function useReportSubmission(actor: string, context: ReportContext, onDone: () => void) {
	const [draft, setDraft] = useState(() => restore(actor, context.targetId));
	const [error, setError] = useState<string | null>(null);
	const inFlight = useRef(false);
	const identity = useRef<Pick<Draft, "key" | "fingerprint">>({
		key: draft.key,
		fingerprint: draft.fingerprint,
	});
	const client = useQueryClient();
	const mutation = useMutation({
		mutationFn: (input: ReportInput) => reportsService.create(input),
		retry: false,
	});
	const store = (next: Draft) => {
		try {
			sessionStorage.setItem(draftKey(actor, context.targetId), JSON.stringify(next));
		} catch {
			/* A blocked storage backend must not prevent submission. */
		}
	};
	const change = (next: Draft) => {
		if (
			JSON.stringify([context.targetId, next.reportType, next.description.trim()]) !==
			identity.current.fingerprint
		)
			identity.current = {};
		setDraft(next);
		setError(null);
		store({ ...next, ...identity.current });
	};
	const clear = () => {
		identity.current = {};
		try {
			sessionStorage.removeItem(draftKey(actor, context.targetId));
		} catch {
			/* No stored draft. */
		}
	};
	const submit = async () => {
		if (inFlight.current) return;
		const invalid = descriptionError(draft.description);
		if (invalid) {
			setError(invalid);
			return;
		}
		const description = draft.description.trim();
		const fingerprint = JSON.stringify([context.targetId, draft.reportType, description]);
		if (identity.current.fingerprint !== fingerprint || !identity.current.key)
			identity.current = { key: crypto.randomUUID(), fingerprint };
		store({ ...draft, ...identity.current });
		inFlight.current = true;
		setError(null);
		try {
			await mutation.mutateAsync({
				idempotencyKey: identity.current.key as string,
				reportType: draft.reportType,
				targetType: "trip_review",
				targetId: context.targetId,
				description,
			});
			clear();
			void client.invalidateQueries({ queryKey: queryKeys.myContentReports.all(actor) });
			toast.success("Báo cáo đã được ghi nhận. Bạn có thể theo dõi tại Báo cáo đánh giá.");
			onDone();
		} catch (failure) {
			if (reportErrorCode(failure) === "REPORT_ALREADY_OPEN") {
				await client.invalidateQueries({ queryKey: queryKeys.myContentReports.all(actor) });
				await client
					.fetchQuery({
						queryKey: queryKeys.myContentReports.list(actor, 1),
						queryFn: () => reportsService.list(1),
						retry: false,
					})
					.catch(() => undefined);
				clear();
				toast.info(
					"Báo cáo trước cho nội dung này đã được ghi nhận và đang được xem xét. Hãy kiểm tra Báo cáo đánh giá."
				);
				onDone();
			} else {
				if (reportErrorCode(failure) === "REPORT_IDEMPOTENCY_CONFLICT") {
					identity.current = {};
					store({ ...draft, key: undefined, fingerprint: undefined });
					console.error("Content report idempotency conflict");
				}
				setError(reportErrorMessage(failure));
			}
		} finally {
			inFlight.current = false;
		}
	};
	return { draft, change, error, submit, pending: mutation.isPending, clear };
}
