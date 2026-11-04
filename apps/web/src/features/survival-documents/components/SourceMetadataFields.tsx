import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { CATEGORY_LABELS, SOURCE_INPUT } from "../constants";
import type { SourceFormValues } from "../schema/source.schema";
const fields: Array<{
	name: keyof SourceFormValues;
	label: string;
	type?: string;
	long?: boolean;
}> = [
	{ name: "sourceTitle", label: "Tên tài liệu" },
	{ name: "publisher", label: "Tổ chức xuất bản" },
	{ name: "sourceUrl", label: "Đường dẫn bản gốc", type: "url" },
	{ name: "locale", label: "Ngôn ngữ tài liệu" },
	{ name: "originalLocale", label: "Ngôn ngữ bản gốc" },
	{ name: "sourcePublishedAt", label: "Ngày xuất bản", type: "date" },
	{ name: "retrievedAt", label: "Ngày truy cập", type: "date" },
	{ name: "licenseType", label: "Loại giấy phép" },
	{ name: "licenseUrl", label: "Đường dẫn điều khoản", type: "url" },
	{ name: "permissionEvidence", label: "Minh chứng quyền sử dụng", long: true },
	{ name: "attribution", label: "Ghi công nguồn", long: true },
	{ name: "changeSummary", label: "Nội dung thay đổi", long: true },
	{ name: "originalVersionId", label: "Mã phiên bản gốc nếu dịch hoặc chuyển thể" },
	{ name: "adaptationDisclaimer", label: "Thông báo bản dịch hoặc chuyển thể", long: true },
];
export function SourceMetadataFields({
	register,
	errors,
}: { register: UseFormRegister<SourceFormValues>; errors: FieldErrors<SourceFormValues> }) {
	return (
		<div className="grid gap-3 sm:grid-cols-2">
			<label className="text-sm font-semibold">
				Phân loại
				<select className={SOURCE_INPUT} {...register("classification")}>
					{Object.entries(CATEGORY_LABELS).map(([key, label]) => (
						<option key={key} value={key}>
							{label}
						</option>
					))}
				</select>
			</label>
			{fields.map((field) => (
				<label
					key={field.name}
					className={`text-sm font-semibold ${field.long ? "sm:col-span-2" : ""}`}
				>
					{field.label}
					{field.long ? (
						<textarea rows={3} className={SOURCE_INPUT} {...register(field.name)} />
					) : (
						<input type={field.type ?? "text"} className={SOURCE_INPUT} {...register(field.name)} />
					)}
					{errors[field.name] && (
						<span className="text-xs text-red-700">{String(errors[field.name]?.message)}</span>
					)}
				</label>
			))}
		</div>
	);
}
