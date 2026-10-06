import { z } from "zod";
import { MAX_CERTIFICATIONS, MAX_LANGUAGES, MAX_TAG_LENGTH } from "../constants";

function hasDuplicatesCaseInsensitive(items: string[]): boolean {
	const seen = new Set<string>();
	for (const item of items) {
		const normalized = item.trim().toLowerCase();
		if (seen.has(normalized)) {
			return true;
		}
		seen.add(normalized);
	}
	return false;
}

const stringArraySchema = (maxItems: number, fieldName: string) =>
	z
		.array(
			z
				.string()
				.transform((val) => val.trim())
				.pipe(
					z
						.string()
						.min(1, `${fieldName} không được để trống`)
						.max(MAX_TAG_LENGTH, `${fieldName} không được vượt quá ${MAX_TAG_LENGTH} ký tự`)
				)
		)
		.max(maxItems, `Tối đa ${maxItems} ${fieldName.toLowerCase()}`)
		.refine((items) => !hasDuplicatesCaseInsensitive(items), {
			message: `Không được có ${fieldName.toLowerCase()} trùng lặp`,
		});

export const porterProfileSchema = z.object({
	experienceYears: z
		.number({
			required_error: "Số năm kinh nghiệm là bắt buộc",
			invalid_type_error: "Số năm kinh nghiệm phải là số nguyên",
		})
		.int("Số năm kinh nghiệm phải là số nguyên (không có số thập phân)")
		.min(0, "Số năm kinh nghiệm không được âm"),
	certifications: stringArraySchema(MAX_CERTIFICATIONS, "Chứng chỉ"),
	languages: stringArraySchema(MAX_LANGUAGES, "Ngôn ngữ"),
	availabilityStatus: z.enum(["available", "unavailable"], {
		required_error: "Trạng thái sẵn sàng là bắt buộc",
	}),
});

export type PorterProfileFormValues = z.infer<typeof porterProfileSchema>;
