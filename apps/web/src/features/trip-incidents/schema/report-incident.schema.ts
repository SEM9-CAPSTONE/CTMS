import { z } from "zod";
import {
	INCIDENT_CLOCK_SKEW_MS,
	INCIDENT_DESCRIPTION_MAX_LENGTH,
	INCIDENT_PHOTO_MAX_BYTES,
	INCIDENT_PHOTO_TYPES,
} from "../constants";
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES } from "../types";

const photoTypes: readonly string[] = INCIDENT_PHOTO_TYPES;

export const reportIncidentSchema = z.object({
	category: z.enum(INCIDENT_CATEGORIES, {
		errorMap: () => ({ message: "Vui lòng chọn loại sự cố" }),
	}),
	severity: z.enum(INCIDENT_SEVERITIES, {
		errorMap: () => ({ message: "Vui lòng chọn mức độ" }),
	}),
	description: z
		.string()
		.trim()
		.min(1, "Vui lòng mô tả sự cố")
		.max(INCIDENT_DESCRIPTION_MAX_LENGTH, "Mô tả tối đa 2000 ký tự"),
	occurredAt: z
		.string()
		.min(1, "Vui lòng chọn thời điểm xảy ra")
		.refine((value) => !Number.isNaN(Date.parse(value)), "Thời điểm không hợp lệ")
		.refine(
			(value) => Date.parse(value) <= Date.now() + INCIDENT_CLOCK_SKEW_MS,
			"Thời điểm xảy ra không được ở tương lai"
		),
	photo: z
		.custom<File | null>((value) => value === null || value instanceof File)
		.refine((file) => !file || photoTypes.includes(file.type), "Ảnh phải là JPEG, PNG hoặc WebP")
		.refine((file) => !file || file.size <= INCIDENT_PHOTO_MAX_BYTES, "Ảnh không quá 5 MB"),
});

export type ReportIncidentFormValues = z.infer<typeof reportIncidentSchema>;

/** `datetime-local` value for the current minute in the device timezone. */
export function toLocalDateTimeInput(date: Date): string {
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return local.toISOString().slice(0, 16);
}
