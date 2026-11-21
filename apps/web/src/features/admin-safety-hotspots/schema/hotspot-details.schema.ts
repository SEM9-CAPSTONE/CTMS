import { z } from "zod";

export const hotspotDetailsSchema = z.object({
	name: z.string().trim().min(1, "Vui lòng nhập tên điểm nóng.").max(120, "Tên tối đa 120 ký tự."),
	description: z.string().trim().max(1000, "Mô tả tối đa 1.000 ký tự."),
	severity: z.enum(["low", "medium", "high"]),
});

export type HotspotDetailsFormValues = z.infer<typeof hotspotDetailsSchema>;
