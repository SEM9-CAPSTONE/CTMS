import { z } from "zod";

export const weatherRuleSchema = z
	.object({
		rainfallYellowThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập lượng mưa Mức Vàng" })
			.min(0, "Lượng mưa không được âm"),
		rainfallRedThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập lượng mưa Mức Đỏ" })
			.min(0, "Lượng mưa không được âm"),

		windYellowThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập tốc độ gió Mức Vàng" })
			.min(0, "Tốc độ gió không được âm"),
		windRedThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập tốc độ gió Mức Đỏ" })
			.min(0, "Tốc độ gió không được âm"),

		tempLowYellow: z.number({ invalid_type_error: "Vui lòng nhập nhiệt độ thấp Mức Vàng" }),
		tempLowRed: z.number({ invalid_type_error: "Vui lòng nhập nhiệt độ thấp Mức Đỏ" }),
		tempHighYellow: z.number({ invalid_type_error: "Vui lòng nhập nhiệt độ cao Mức Vàng" }),
		tempHighRed: z.number({ invalid_type_error: "Vui lòng nhập nhiệt độ cao Mức Đỏ" }),

		visibilityYellowThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập tầm nhìn Mức Vàng" })
			.min(0, "Tầm nhìn không được âm"),
		visibilityRedThreshold: z
			.number({ invalid_type_error: "Vui lòng nhập tầm nhìn Mức Đỏ" })
			.min(0, "Tầm nhìn không được âm"),

		thunderstormYellow: z.boolean().default(true),
		thunderstormRed: z.boolean().default(true),

		rainfallWeight: z
			.number({ invalid_type_error: "Nhập trọng số mưa" })
			.min(0, "Trọng số từ 0.0 - 1.0")
			.max(1, "Trọng số từ 0.0 - 1.0"),
		windWeight: z
			.number({ invalid_type_error: "Nhập trọng số gió" })
			.min(0, "Trọng số từ 0.0 - 1.0")
			.max(1, "Trọng số từ 0.0 - 1.0"),
		temperatureWeight: z
			.number({ invalid_type_error: "Nhập trọng số nhiệt độ" })
			.min(0, "Trọng số từ 0.0 - 1.0")
			.max(1, "Trọng số từ 0.0 - 1.0"),
		visibilityWeight: z
			.number({ invalid_type_error: "Nhập trọng số tầm nhìn" })
			.min(0, "Trọng số từ 0.0 - 1.0")
			.max(1, "Trọng số từ 0.0 - 1.0"),
		thunderstormWeight: z
			.number({ invalid_type_error: "Nhập trọng số dông sét" })
			.min(0, "Trọng số từ 0.0 - 1.0")
			.max(1, "Trọng số từ 0.0 - 1.0"),

		greenMaxScore: z
			.number({ invalid_type_error: "Nhập điểm trần Mức Xanh" })
			.min(0, "Điểm không được âm"),
		yellowMaxScore: z
			.number({ invalid_type_error: "Nhập điểm trần Mức Vàng" })
			.min(0, "Điểm không được âm"),

		isActive: z.boolean().default(true),
	})
	.refine((data) => data.rainfallYellowThreshold < data.rainfallRedThreshold, {
		message: "Ngưỡng lượng mưa Mức Vàng phải nhỏ hơn Mức Đỏ",
		path: ["rainfallYellowThreshold"],
	})
	.refine((data) => data.windYellowThreshold < data.windRedThreshold, {
		message: "Ngưỡng tốc độ gió Mức Vàng phải nhỏ hơn Mức Đỏ",
		path: ["windYellowThreshold"],
	})
	.refine((data) => data.visibilityYellowThreshold > data.visibilityRedThreshold, {
		message: "Ngưỡng tầm nhìn Mức Vàng phải lớn hơn Mức Đỏ (vì tầm nhìn càng thấp càng nguy hiểm)",
		path: ["visibilityYellowThreshold"],
	})
	.refine(
		(data) =>
			data.tempLowRed < data.tempLowYellow &&
			data.tempLowYellow < data.tempHighYellow &&
			data.tempHighYellow < data.tempHighRed,
		{
			message: "Thứ tự nhiệt độ phải là: Thấp Mức Đỏ < Thấp Mức Vàng < Cao Mức Vàng < Cao Mức Đỏ",
			path: ["tempLowYellow"],
		}
	)
	.refine((data) => data.greenMaxScore < data.yellowMaxScore, {
		message: "Điểm trần Mức Xanh phải nhỏ hơn điểm trần Mức Vàng",
		path: ["greenMaxScore"],
	})
	.refine(
		(data) => {
			const sum =
				data.rainfallWeight +
				data.windWeight +
				data.temperatureWeight +
				data.visibilityWeight +
				data.thunderstormWeight;
			return Math.abs(sum - 1.0) < 0.001;
		},
		{
			message:
				"Tổng các trọng số tiêu chí (mưa, gió, nhiệt độ, tầm nhìn, dông sét) phải đúng bằng 1.0",
			path: ["rainfallWeight"],
		}
	);

export type WeatherRuleFormValues = z.infer<typeof weatherRuleSchema>;
