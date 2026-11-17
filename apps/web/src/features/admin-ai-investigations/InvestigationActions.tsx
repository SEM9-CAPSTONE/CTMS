import { type FormEvent, useId, useState } from "react";
import { Button } from "../../shared/components";
import { technicalLabels } from "./ai-investigations.display";
import type {
	Disposition,
	InvestigationCommand,
	InvestigationDetail,
} from "./ai-investigations.types";

type FormAction = "HANDOFF" | "RESOLVE";
type Field = "reference" | "verification" | "disposition" | "resolutionNote";
const fieldClass =
	"block w-full rounded-lg border border-[#dfe8df] bg-white px-3 py-2 text-sm text-[#10221b]";
const issueKey = "[A-Z][A-Z0-9]{1,19}-[1-9]\\d{0,11}";
const referencePattern = new RegExp(
	`^(?:${issueKey}|https://[a-z0-9-]+\\.atlassian\\.net/browse/${issueKey}|https://github\\.com/[\\w.-]+/[\\w.-]+/(?:issues|pull)/[1-9]\\d{0,11})$`
);

export function InvestigationActions({
	detail,
	busy,
	onSave,
}: {
	detail: InvestigationDetail;
	busy: boolean;
	onSave: (command: InvestigationCommand) => Promise<boolean>;
}) {
	const formId = useId();
	const [action, setAction] = useState<FormAction | null>(null);
	const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
	if (detail.closedAt || detail.reviewStatus === "actioned") return null;
	if (detail.reviewStatus === "pending") {
		return (
			<Button
				disabled={busy}
				onClick={() => void onSave({ action: "START_REVIEW", version: detail.version })}
			>
				Bắt đầu xem xét
			</Button>
		);
	}

	const open = (kind: FormAction | null) => {
		setErrors({});
		setAction(kind);
	};
	const submit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!action || busy) return;
		const form = new FormData(event.currentTarget);
		const reference = String(form.get("reference") ?? "").trim();
		const verification = String(form.get("verification") ?? "").trim();
		const resolutionNote = String(form.get("resolutionNote") ?? "").trim();
		const disposition = form.get("disposition");
		const nextErrors: Partial<Record<Field, string>> = {};
		if (reference ? !referencePattern.test(reference) : action === "HANDOFF") {
			nextErrors.reference =
				"Nhập mã hoặc đường dẫn Jira, hoặc đường dẫn issue hay pull request trên GitHub.";
		}
		if (!verification)
			nextErrors.verification = "Vui lòng nhập nội dung cần xác minh hoặc kết quả xác minh.";
		if (action === "RESOLVE") {
			if (disposition !== "VERIFIED_FIX" && disposition !== "JUSTIFIED_NO_FIX")
				nextErrors.disposition = "Chọn kết luận xử lý.";
			if (!resolutionNote) nextErrors.resolutionNote = "Nhập ghi chú kết luận.";
		}
		setErrors(nextErrors);
		if (Object.keys(nextErrors).length) return;
		const command: InvestigationCommand =
			action === "HANDOFF"
				? { action, version: detail.version, reference, verification }
				: {
						action,
						version: detail.version,
						disposition: disposition as Disposition,
						reference: reference || null,
						verification,
						resolutionNote,
					};
		if (await onSave(command)) open(null);
	};

	if (!action)
		return (
			<div className="flex flex-wrap gap-2">
				<Button disabled={busy} variant="outline" onClick={() => open("HANDOFF")}>
					Bàn giao kỹ thuật
				</Button>
				<Button disabled={busy} onClick={() => open("RESOLVE")}>
					Xác nhận kết quả xử lý
				</Button>
			</div>
		);

	const isResolve = action === "RESOLVE";
	const validation = (field: Field) => ({
		"aria-invalid": errors[field] ? true : undefined,
		"aria-describedby": errors[field] ? `${formId}-${field}` : undefined,
	});
	const fieldError = (field: Field) =>
		errors[field] && (
			<span id={`${formId}-${field}`} className="block text-sm text-red-700">
				{errors[field]}
			</span>
		);
	return (
		<form
			onSubmit={(event) => void submit(event)}
			className="rounded-xl border border-[#dfe8df] bg-[#f8faf7] p-4"
		>
			<fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
				<legend className="mb-2 text-base font-bold text-[#10221b]">
					{isResolve ? "Kết quả xử lý" : "Bàn giao kỹ thuật"}
				</legend>
				{isResolve && (
					<div className="space-y-1 text-sm font-medium">
						<label htmlFor={`${formId}-disposition-input`}>Kết luận</label>
						<select
							id={`${formId}-disposition-input`}
							name="disposition"
							className={fieldClass}
							{...validation("disposition")}
						>
							<option value="">Chọn kết luận</option>
							<option value="VERIFIED_FIX">{technicalLabels.VERIFIED_FIX[0]}</option>
							<option value="JUSTIFIED_NO_FIX">{technicalLabels.JUSTIFIED_NO_FIX[0]}</option>
						</select>
						{fieldError("disposition")}
					</div>
				)}
				<label className="block space-y-1 text-sm font-medium">
					<span>
						{isResolve ? "Mã hoặc đường dẫn tham chiếu (nếu có)" : "Mã hoặc đường dẫn bàn giao"}
					</span>
					<input
						name="reference"
						type="text"
						maxLength={300}
						className={fieldClass}
						{...validation("reference")}
					/>
					{fieldError("reference")}
				</label>
				<label className="block space-y-1 text-sm font-medium">
					<span>{isResolve ? "Phạm vi và kết quả xác minh" : "Nội dung cần xác minh"}</span>
					<textarea
						name="verification"
						rows={3}
						maxLength={2000}
						className={fieldClass}
						{...validation("verification")}
					/>
					{fieldError("verification")}
				</label>
				{isResolve && (
					<label className="block space-y-1 text-sm font-medium">
						<span>Ghi chú kết luận</span>
						<textarea
							name="resolutionNote"
							rows={3}
							maxLength={2000}
							className={fieldClass}
							{...validation("resolutionNote")}
						/>
						{fieldError("resolutionNote")}
					</label>
				)}
				<div className="flex flex-wrap justify-end gap-2">
					<Button variant="ghost" onClick={() => open(null)}>
						Hủy
					</Button>
					<Button type="submit">{isResolve ? "Lưu kết luận và đóng hồ sơ" : "Lưu bàn giao"}</Button>
				</div>
			</fieldset>
		</form>
	);
}
