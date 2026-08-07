import { z } from "zod";

export const camperProfileSchema = z.object({
	fullName: z
		.string()
		.min(2, "Họ và tên phải có ít nhất 2 ký tự")
		.max(50, "Họ và tên không vượt quá 50 ký tự"),
	dateOfBirth: z.string().min(1, "Vui lòng chọn ngày sinh"),
	gender: z.enum(["male", "female", "other"], {
		invalid_type_error: "Giới tính không hợp lệ",
	}),
	address: z
		.string()
		.min(5, "Địa chỉ phải từ 5 ký tự trở lên")
		.max(200, "Địa chỉ không quá 200 ký tự"),
	bio: z.string().max(500, "Giới thiệu không vượt quá 500 ký tự").optional(),
	campingExperienceYears: z
		.number({ invalid_type_error: "Kinh nghiệm phải là số" })
		.min(0, "Kinh nghiệm không được nhỏ hơn 0")
		.max(50, "Số năm kinh nghiệm không quá 50 năm"),
	trekkingExperienceDetails: z
		.string()
		.max(300, "Mô tả kinh nghiệm không quá 300 ký tự")
		.optional(),
});

export type CamperProfileFormValues = z.infer<typeof camperProfileSchema>;
