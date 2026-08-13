import { z } from "zod";

export const emergencyContactSchema = z.object({
	id: z.string().optional(),
	name: z
		.string()
		.min(2, "Tên liên hệ khẩn cấp phải có ít nhất 2 ký tự")
		.max(80, "Tên liên hệ không quá 80 ký tự"),
	relationship: z
		.string()
		.min(2, "Mối quan hệ phải có ít nhất 2 ký tự")
		.max(40, "Mối quan hệ không quá 40 ký tự"),
	phone: z.string().regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, "Số điện thoại khẩn cấp không hợp lệ"),
	email: z
		.string()
		.email("Email liên hệ không hợp lệ")
		.max(254, "Email không quá 254 ký tự")
		.optional()
		.or(z.literal("")),
});

function parseProfileDate(value: string): Date | null {
	const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
	if (ddmmyyyy) {
		const [, day, month, year] = ddmmyyyy;
		const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
		return parsedDate.getFullYear() === Number(year) &&
			parsedDate.getMonth() === Number(month) - 1 &&
			parsedDate.getDate() === Number(day)
			? parsedDate
			: null;
	}

	const yyyymmdd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (yyyymmdd) {
		const [, year, month, day] = yyyymmdd;
		const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
		return parsedDate.getFullYear() === Number(year) &&
			parsedDate.getMonth() === Number(month) - 1 &&
			parsedDate.getDate() === Number(day)
			? parsedDate
			: null;
	}

	return null;
}

export const camperProfileSchema = z.object({
	fullName: z
		.string()
		.min(2, "Họ và tên phải có ít nhất 2 ký tự")
		.max(50, "Họ và tên không vượt quá 50 ký tự"),
	dateOfBirth: z
		.string()
		.min(1, "Vui lòng nhập ngày sinh")
		.regex(/^(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})$/, "Ngày sinh phải theo định dạng dd/mm/yyyy")
		.refine((value) => {
			const selectedDate = parseProfileDate(value);
			const today = new Date();
			today.setHours(23, 59, 59, 999);
			return selectedDate !== null && selectedDate <= today;
		}, "Ngày sinh không được ở tương lai"),
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
	emergencyContacts: z
		.array(emergencyContactSchema)
		.max(2, "Mỗi tài khoản chỉ được lưu tối đa 2 liên hệ khẩn cấp"),
});

export type CamperProfileFormValues = z.infer<typeof camperProfileSchema>;
