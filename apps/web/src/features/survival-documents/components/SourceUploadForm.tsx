import { zodResolver } from "@hookform/resolvers/zod";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "../../../shared/components";
import { SOURCE_BUTTON, SOURCE_INPUT } from "../constants";
import { type SourceFormValues, sourceSchema } from "../schema/source.schema";
import type { SourceMetadata, SourceReference } from "../types";
import { SourceMetadataFields } from "./SourceMetadataFields";

export function SourceUploadForm({
	initial,
	reference,
	editing,
	maxBytes,
	busy,
	error,
	onClose,
	onSubmit,
}: {
	initial?: SourceMetadata;
	reference?: SourceReference;
	editing: boolean;
	maxBytes: number;
	busy: boolean;
	error: Error | null;
	onClose: () => void;
	onSubmit: (metadata: SourceMetadata, file?: File) => Promise<void>;
}) {
	const [file, setFile] = useState<File>();
	const [fileError, setFileError] = useState("");
	const submitting = useRef(false);
	const language = reference?.language === "multi" ? "vi" : (reference?.language ?? "vi");
	const form = useForm<SourceFormValues>({
		resolver: zodResolver(sourceSchema),
		defaultValues: initial
			? {
					...initial,
					sourcePublishedAt: initial.sourcePublishedAt?.slice(0, 10),
					retrievedAt: initial.retrievedAt.slice(0, 10),
				}
			: {
					sourceTitle: reference?.title ?? "",
					publisher: reference?.publisher ?? "",
					sourceUrl: reference?.contentUrl ?? "",
					classification: reference?.category ?? "TREKKING_SAFETY",
					locale: language,
					originalLocale: language,
					retrievedAt: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(
						new Date()
					),
					licenseType: "",
					licenseUrl: "",
					permissionEvidence: "",
					changeSummary: "",
					attribution: "",
				},
	});
	const submit = form.handleSubmit(async (values) => {
		if (submitting.current || busy) return;
		if (
			!editing &&
			(!file ||
				file.type !== "application/pdf" ||
				!/\.pdf$/i.test(file.name) ||
				file.size > maxBytes)
		) {
			setFileError(`Chọn PDF tối đa ${Math.floor(maxBytes / 1048576)} MiB.`);
			return;
		}
		submitting.current = true;
		try {
			await onSubmit(sourceSchema.parse(values), file);
		} finally {
			submitting.current = false;
		}
	});
	return (
		<Modal
			isOpen
			onClose={onClose}
			isCloseDisabled={busy}
			title={editing ? "Sửa thông tin bản nháp" : "Thêm nguồn tài liệu"}
			size="xl"
		>
			<form onSubmit={submit} className="space-y-4">
				<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
					Tài liệu được lưu riêng tư. Quyền xử lý AI, phân phối ngoại tuyến và dịch được xác minh
					riêng khi xét duyệt.
				</p>
				<fieldset disabled={busy} className="space-y-4">
					{!editing && (
						<label className="block text-sm font-semibold">
							Tệp PDF
							<input
								aria-label="Tệp PDF"
								type="file"
								accept="application/pdf,.pdf"
								className={SOURCE_INPUT}
								onChange={(event) => {
									setFile(event.target.files?.[0]);
									setFileError("");
								}}
							/>
							{fileError && (
								<span role="alert" className="text-red-700">
									{fileError}
								</span>
							)}
						</label>
					)}
					<SourceMetadataFields register={form.register} errors={form.formState.errors} />
				</fieldset>
				{error && (
					<p role="alert" className="text-sm text-red-700">
						{error.message}
					</p>
				)}
				<button
					disabled={busy || form.formState.isSubmitting}
					type="submit"
					className={SOURCE_BUTTON}
				>
					{busy ? "Đang lưu…" : "Lưu bản nháp"}
				</button>
			</form>
		</Modal>
	);
}
