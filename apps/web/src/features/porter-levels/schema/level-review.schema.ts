import { z } from "zod";
export const levelDecisionSchema = z.object({
	outcome: z.enum(["approved", "rejected"]),
	reason: z.string().trim().min(1, "Vui lòng nhập lý do xét cấp").max(2000),
});
export const levelSkillsSchema = z.object({
	skills: z
		.string()
		.transform((value) =>
			value
				.split("\n")
				.map((item) => item.trim())
				.filter(Boolean)
		)
		.pipe(
			z.array(z.string().max(100, "Mỗi kỹ năng tối đa 100 ký tự")).max(20, "Tối đa 20 kỹ năng")
		),
});
