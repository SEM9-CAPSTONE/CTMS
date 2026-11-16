import { z } from "zod";

export const hotspotReviewSchema = z.object({
	reason: z
		.string()
		.trim()
		.min(10, "Lý do cần tối thiểu 10 ký tự.")
		.max(1000, "Lý do tối đa 1.000 ký tự."),
});

export type HotspotReviewFormValues = z.infer<typeof hotspotReviewSchema>;
