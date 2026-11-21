import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { REPORT_LABELS, REPORT_LIMIT, reportDate } from "../constants";
import { useReportSubmission } from "../hooks/useReportSubmission";
import type { ReportContext, ReportType } from "../types";
import { reportLength } from "../utils/report-input";

export function ReportDialog({
	actor,
	context,
	onClose,
}: {
	actor: string;
	context: ReportContext;
	onClose: () => void;
}) {
	const state = useReportSubmission(actor, context, onClose);
	const root = useRef<HTMLFormElement>(null);
	const id = useId();
	const close = () => {
		state.clear();
		onClose();
	};
	useEffect(() => {
		const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const dialog = root.current?.closest<HTMLElement>('[role="dialog"]');
		const focusable = () =>
			Array.from(
				dialog?.querySelectorAll<HTMLElement>(
					'button:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
				) ?? []
			);
		root.current?.querySelector<HTMLSelectElement>("select")?.focus();
		const trap = (event: KeyboardEvent) => {
			if (event.key !== "Tab") return;
			const nodes = focusable();
			const first = nodes[0];
			const last = nodes[nodes.length - 1];
			if (
				event.shiftKey &&
				(document.activeElement === first || !dialog?.contains(document.activeElement))
			) {
				event.preventDefault();
				last?.focus();
			} else if (
				!event.shiftKey &&
				(document.activeElement === last || !dialog?.contains(document.activeElement))
			) {
				event.preventDefault();
				first?.focus();
			}
		};
		document.addEventListener("keydown", trap);
		return () => {
			document.removeEventListener("keydown", trap);
			trigger?.focus();
		};
	}, []);
	const count = reportLength(state.draft.description);
	return createPortal(
		<Modal isOpen title="Báo cáo nội dung" onClose={close} isCloseDisabled={state.pending}>
			<form
				ref={root}
				onSubmit={(event) => {
					event.preventDefault();
					void state.submit();
				}}
				className="space-y-4"
			>
				<section className="border-b border-border pb-4" aria-label="Nội dung đang báo cáo">
					<p className="font-semibold text-brand-dark">{context.label}</p>
					<p className="mt-1 text-xs text-slate-700">{reportDate(context.createdAt)}</p>
					<p className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-700">
						{context.comment || "Đánh giá không có nhận xét."}
					</p>
				</section>
				<div>
					<label htmlFor={`${id}-type`} className="mb-2 block text-sm font-semibold">
						Loại báo cáo
					</label>
					<select
						id={`${id}-type`}
						disabled={state.pending}
						value={state.draft.reportType}
						onChange={(event) =>
							state.change({ ...state.draft, reportType: event.target.value as ReportType })
						}
						className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm focus:outline-2 focus:outline-green-800"
					>
						{Object.entries(REPORT_LABELS).map(([code, label]) => (
							<option key={code} value={code}>
								{label}
							</option>
						))}
					</select>
				</div>
				<div>
					<label htmlFor={`${id}-description`} className="mb-2 block text-sm font-semibold">
						Mô tả báo cáo <span aria-hidden="true">*</span>
					</label>
					<textarea
						id={`${id}-description`}
						required
						rows={5}
						disabled={state.pending}
						value={state.draft.description}
						aria-invalid={Boolean(state.error)}
						aria-describedby={`${id}-count${state.error ? ` ${id}-error` : ""}`}
						onChange={(event) => state.change({ ...state.draft, description: event.target.value })}
						className="w-full resize-y rounded-xl border border-slate-300 p-3 text-sm focus:outline-2 focus:outline-green-800"
						placeholder={
							state.draft.reportType === "dangerous_content"
								? "Ví dụ: Hướng dẫn đi vào khu vực cấm."
								: "Ví dụ: Độ khó đường đi không đúng thực tế."
						}
					/>
					<p
						id={`${id}-count`}
						className={`mt-1 text-right text-xs ${count > REPORT_LIMIT ? "text-red-700" : "text-slate-700"}`}
					>
						{count.toLocaleString("vi-VN")} / 1.000 ký tự
						{count > REPORT_LIMIT ? ` · Vượt quá ${count - REPORT_LIMIT} ký tự` : ""}
					</p>
					<span className="sr-only" aria-live="polite">
						{count > REPORT_LIMIT
							? "Mô tả đã vượt giới hạn ký tự."
							: count >= 950
								? "Mô tả sắp đạt giới hạn ký tự."
								: ""}
					</span>
					{state.error && (
						<p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">
							{state.error}
						</p>
					)}
				</div>
				<p className="text-xs leading-5 text-slate-700">
					Báo cáo sẽ được xem xét. Gửi báo cáo không tự động gỡ đánh giá.
				</p>
				<div className="flex justify-end gap-3 border-t border-border pt-4">
					<Button variant="outline" disabled={state.pending} onClick={close}>
						Đóng
					</Button>
					<Button type="submit" disabled={state.pending || count === 0 || count > REPORT_LIMIT}>
						{state.pending ? "Đang gửi…" : "Gửi báo cáo"}
					</Button>
				</div>
			</form>
		</Modal>,
		document.body
	);
}
