import { z } from "zod";

export const porterRouteQualificationSchema = z.object({
	routeId: z
		.string({ required_error: "Vui lòng chọn tuyến trekking" })
		.min(1, "Vui lòng chọn tuyến trekking"),
	proficiency: z.enum(["learning", "proficient", "expert"], {
		required_error: "Mức độ thành thạo là bắt buộc",
	}),
	timesLed: z
		.number({
			required_error: "Số lần dẫn đoàn là bắt buộc",
			invalid_type_error: "Số lần dẫn đoàn phải là số nguyên",
		})
		.int("Số lần dẫn đoàn phải là số nguyên (không có số thập phân)")
		.min(0, "Số lần dẫn đoàn không được âm"),
});

export type PorterRouteQualificationFormValues = z.infer<typeof porterRouteQualificationSchema>;
