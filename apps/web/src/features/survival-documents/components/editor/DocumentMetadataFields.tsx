import { ChevronDown, Languages, Mountain } from "lucide-react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { CATEGORY_LABELS, SOURCE_INPUT } from "../../constants";
import type { DocumentEditorValues } from "../../schema/source.schema";
import type { SourceMetadata } from "../../types";

interface MetadataFieldsProps {
	register: UseFormRegister<DocumentEditorValues>;
	errors: FieldErrors<SourceMetadata>;
	existingLocale?: string;
}

const SELECT_STYLE = `${SOURCE_INPUT} appearance-none pl-10 pr-7 font-normal`;
const LEADING_ICON_STYLE =
	"pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-slate-500";
const TRAILING_ICON_STYLE =
	"pointer-events-none absolute right-2.5 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-slate-600";

export function DocumentMetadataFields({ register, errors, existingLocale }: MetadataFieldsProps) {
	const hasLegacyLocale = existingLocale && existingLocale !== "vi" && existingLocale !== "en";

	return (
		<div className="grid grid-cols-2 gap-x-3 gap-y-4">
			<label className="col-span-2 block min-w-0 text-sm font-semibold">
				Tên tài liệu{" "}
				<span aria-hidden="true" className="text-red-600">
					*
				</span>
				<input
					type="text"
					aria-label="Tên tài liệu"
					aria-required="true"
					aria-invalid={!!errors.sourceTitle}
					placeholder="Ví dụ: Cẩm nang sinh tồn trong rừng"
					className={`${SOURCE_INPUT} font-normal`}
					{...register("metadata.sourceTitle")}
				/>
				{errors.sourceTitle?.message && (
					<span className="mt-1 block text-xs text-red-700">{errors.sourceTitle.message}</span>
				)}
			</label>
			<label className="block min-w-0 text-sm font-semibold">
				Phân loại{" "}
				<span aria-hidden="true" className="text-red-600">
					*
				</span>
				<span className="relative block">
					<Mountain className={LEADING_ICON_STYLE} aria-hidden="true" />
					<select
						aria-label="Phân loại"
						aria-required="true"
						aria-invalid={!!errors.classification}
						className={SELECT_STYLE}
						{...register("metadata.classification")}
					>
						{Object.entries(CATEGORY_LABELS).map(([key, label]) => (
							<option key={key} value={key}>
								{label}
							</option>
						))}
					</select>
					<ChevronDown className={TRAILING_ICON_STYLE} aria-hidden="true" />
				</span>
				{errors.classification?.message && (
					<span className="mt-1 block text-xs text-red-700">{errors.classification.message}</span>
				)}
			</label>
			<label className="block min-w-0 text-sm font-semibold">
				Ngôn ngữ tài liệu{" "}
				<span aria-hidden="true" className="text-red-600">
					*
				</span>
				<span className="relative block">
					<Languages className={LEADING_ICON_STYLE} aria-hidden="true" />
					<select
						aria-label="Ngôn ngữ tài liệu"
						aria-required="true"
						aria-invalid={!!errors.locale}
						className={SELECT_STYLE}
						{...register("metadata.locale")}
					>
						<option value="vi">Tiếng Việt</option>
						<option value="en">Tiếng Anh</option>
						{hasLegacyLocale && <option value={existingLocale}>{existingLocale}</option>}
					</select>
					<ChevronDown className={TRAILING_ICON_STYLE} aria-hidden="true" />
				</span>
				{errors.locale?.message && (
					<span className="mt-1 block text-xs text-red-700">{errors.locale.message}</span>
				)}
			</label>
		</div>
	);
}
