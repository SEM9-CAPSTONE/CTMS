import { z } from "zod";
const list = z
	.string()
	.transform((value) =>
		value
			.split("\n")
			.map((item) => item.trim())
			.filter(Boolean)
	)
	.pipe(z.array(z.string().max(100, "Mỗi mục tối đa 100 ký tự")).max(20, "Tối đa 20 mục"));
const threshold = z
	.string()
	.transform((value) => (value.trim() === "" ? null : Number(value)))
	.pipe(z.number().int("Nhập số nguyên").nonnegative("Không được âm").nullable());
export const levelPolicySchema = z.object({
	name: z.string().trim().min(1, "Nhập tên cấp").max(100),
	minExperienceYears: threshold,
	minTimesLed: threshold,
	requiredSkills: list,
	requiredCertifications: list,
	responsibilities: z.string().trim().min(1, "Nhập phạm vi phụ trách").max(2000),
});
export type LevelPolicyFormInput = z.input<typeof levelPolicySchema>;
export type LevelPolicyFormOutput = z.output<typeof levelPolicySchema>;
