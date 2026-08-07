import { z } from "zod";

export const allergyItemSchema = z.object({
	id: z.string(),
	name: z
		.string()
		.min(1, "Tên dị ứng không được để trống")
		.max(100, "Tên dị ứng không quá 100 ký tự"),
	severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
		invalid_type_error: "Mức độ nghiêm trọng không hợp lệ",
	}),
	reaction: z.string().max(200, "Mô tả phản ứng không quá 200 ký tự").optional(),
});

export const medicalConditionItemSchema = z.object({
	id: z.string(),
	name: z
		.string()
		.min(1, "Tên bệnh lý không được để trống")
		.max(100, "Tên bệnh lý không quá 100 ký tự"),
	medication: z.string().max(200, "Tên thuốc không quá 200 ký tự").optional(),
	notes: z.string().max(300, "Ghi chú không quá 300 ký tự").optional(),
});

export const healthProfileSchema = z.object({
	bloodType: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"], {
		invalid_type_error: "Nhóm máu không hợp lệ",
	}),
	physicalFitnessLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"], {
		invalid_type_error: "Trình độ thể lực không hợp lệ",
	}),
	dietaryRestrictions: z.string().max(300, "Chế độ ăn kiêng không quá 300 ký tự").optional(),
	emergencyNotes: z.string().max(500, "Ghi chú khẩn cấp không quá 500 ký tự").optional(),
	allergies: z.array(allergyItemSchema),
	medicalConditions: z.array(medicalConditionItemSchema),
	isConsentGranted: z.boolean(),
});

export type HealthProfileFormValues = z.infer<typeof healthProfileSchema>;
