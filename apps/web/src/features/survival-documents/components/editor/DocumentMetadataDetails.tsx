import { Building2, ChevronDown, Link, type LucideIcon, NotebookText } from "lucide-react";
import { useState } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { cn } from "../../../../shared/utils/cn";
import { SOURCE_INPUT } from "../../constants";
import type { DocumentEditorValues } from "../../schema/source.schema";
import type { SourceMetadata } from "../../types";

interface MetadataField {
	name: keyof SourceMetadata;
	label: string;
	type?: string;
	long?: boolean;
	icon?: LucideIcon;
	placeholder?: string;
}

const publisherField: MetadataField = {
	name: "publisher",
	label: "Tổ chức / Tác giả",
	icon: Building2,
	placeholder: "Ví dụ: WHO, IFRC, …",
};
const sourceUrlField: MetadataField = {
	name: "sourceUrl",
	label: "URL nguồn tham khảo",
	type: "url",
	icon: Link,
	placeholder: "https://…",
};
const notesField: MetadataField = {
	name: "changeSummary",
	label: "Ghi chú",
	long: true,
	icon: NotebookText,
	placeholder: "Thông tin bổ sung về tài liệu (nếu có)",
};
const provenanceFields: MetadataField[] = [
	{ name: "sourcePublishedAt", label: "Ngày xuất bản nguồn", type: "date" },
	{ name: "retrievedAt", label: "Ngày truy cập", type: "date" },
	{ name: "originalLocale", label: "Ngôn ngữ bản gốc" },
];
const translationFields: MetadataField[] = [
	{ name: "originalVersionId", label: "Mã phiên bản gốc" },
	{ name: "adaptationDisclaimer", label: "Thông báo bản dịch hoặc chuyển thể", long: true },
];

const DISCLOSURE_STYLE = "group rounded-xl border border-[#dfe8df]";
const SUMMARY_STYLE =
	"flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold [&::-webkit-details-marker]:hidden";

interface DocumentMetadataDetailsProps {
	register: UseFormRegister<DocumentEditorValues>;
	errors: FieldErrors<SourceMetadata>;
	includeSourceUrl: boolean;
	editing: boolean;
	translated: boolean;
}

export function DocumentMetadataDetails({
	register,
	errors,
	includeSourceUrl,
	editing,
	translated,
}: DocumentMetadataDetailsProps) {
	const [supplementOpen, setSupplementOpen] = useState(true);
	const supplementary = includeSourceUrl ? [publisherField, sourceUrlField] : [publisherField];
	const provenance = translated ? [...provenanceFields, ...translationFields] : provenanceFields;
	const provenanceError = editing && provenance.some(({ name }) => errors[name]);
	const supplementaryError = [notesField, ...supplementary].some(({ name }) => errors[name]);
	const renderField = ({ name, label, type, long, icon: Icon, placeholder }: MetadataField) => {
		const registration = register(`metadata.${name}`);
		const error = errors[name]?.message;
		const control = {
			className: cn(SOURCE_INPUT, "font-normal", Icon && "pl-10"),
			"aria-invalid": !!error,
			placeholder,
			...registration,
		};

		return (
			<label key={name} className={cn("block min-w-0 text-sm font-semibold", long && "col-span-2")}>
				{label}
				<span className="relative block">
					{Icon && (
						<Icon
							aria-hidden="true"
							className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500"
						/>
					)}
					{long ? <textarea rows={2} {...control} /> : <input type={type ?? "text"} {...control} />}
				</span>
				{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
			</label>
		);
	};

	return (
		<details
			className={cn(DISCLOSURE_STYLE, "bg-[#f5f8f5]")}
			open={supplementOpen || supplementaryError || provenanceError}
			onToggle={(event) => setSupplementOpen(event.currentTarget.open)}
		>
			<summary className={SUMMARY_STYLE}>
				<ChevronDown aria-hidden="true" className="h-4 w-4 -rotate-90 group-open:rotate-0" />
				Thông tin bổ sung (tùy chọn)
			</summary>
			<div className="space-y-3 px-3 pb-3">
				<div className="grid grid-cols-2 gap-3">
					{supplementary.map(renderField)}
					{renderField(notesField)}
				</div>
				{editing && (
					<details
						className="rounded-lg border border-[#dfe8df] bg-white"
						open={provenanceError || undefined}
					>
						<summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
							Thông tin xuất xứ
						</summary>
						<div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">{provenance.map(renderField)}</div>
					</details>
				)}
			</div>
		</details>
	);
}
