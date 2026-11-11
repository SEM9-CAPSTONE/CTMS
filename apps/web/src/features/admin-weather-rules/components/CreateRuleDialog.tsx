import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Loader2, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { type WeatherRuleFormValues, weatherRuleSchema } from "../schema/weather-rule.schema";
import type { CreateWeatherRiskRulePayload } from "../types";

interface CreateRuleDialogProps {
	isOpen: boolean;
	isSubmitting: boolean;
	onClose: () => void;
	onSubmit: (payload: CreateWeatherRiskRulePayload) => Promise<void>;
}

export function CreateRuleDialog({
	isOpen,
	isSubmitting,
	onClose,
	onSubmit,
}: CreateRuleDialogProps) {
	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors },
	} = useForm<WeatherRuleFormValues>({
		resolver: zodResolver(weatherRuleSchema),
		defaultValues: {
			rainfallYellowThreshold: 10,
			rainfallRedThreshold: 50,
			windYellowThreshold: 40,
			windRedThreshold: 70,
			tempLowYellow: 5,
			tempLowRed: 0,
			tempHighYellow: 38,
			tempHighRed: 42,
			visibilityYellowThreshold: 5000,
			visibilityRedThreshold: 1000,
			thunderstormYellow: true,
			thunderstormRed: true,
			rainfallWeight: 0.3,
			windWeight: 0.25,
			temperatureWeight: 0.15,
			visibilityWeight: 0.15,
			thunderstormWeight: 0.15,
			greenMaxScore: 0.5,
			yellowMaxScore: 1.2,
			isActive: true,
		},
	});

	useEffect(() => {
		if (isOpen) {
			reset();
		}
	}, [isOpen, reset]);

	if (!isOpen) return null;

	const rainfallWeight = watch("rainfallWeight") || 0;
	const windWeight = watch("windWeight") || 0;
	const temperatureWeight = watch("temperatureWeight") || 0;
	const visibilityWeight = watch("visibilityWeight") || 0;
	const thunderstormWeight = watch("thunderstormWeight") || 0;
	const currentWeightSum = Number(
		(
			rainfallWeight +
			windWeight +
			temperatureWeight +
			visibilityWeight +
			thunderstormWeight
		).toFixed(3)
	);

	const handleFormSubmit = handleSubmit(async (values) => {
		await onSubmit(values);
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
			<dialog
				open
				aria-labelledby="create-rule-title"
				className="relative my-8 w-full max-w-3xl rounded-2xl bg-white p-0 text-[#10221b] shadow-2xl animate-in fade-in zoom-in-95 duration-200"
			>
				<form onSubmit={handleFormSubmit}>
					<header className="flex items-center justify-between border-b border-[#e0ebe0] p-5">
						<div className="flex items-center gap-3">
							<div className="flex size-9 items-center justify-center rounded-xl bg-[#164027] text-white">
								<ShieldAlert className="size-5" />
							</div>
							<div>
								<h2 id="create-rule-title" className="text-lg font-extrabold">
									Tạo bộ quy tắc rủi ro thời tiết mới
								</h2>
								<p className="text-xs text-[#667a6d]">
									Cấu hình ngưỡng cảnh báo, trọng số tiêu chí và thang điểm đánh giá tự động
								</p>
							</div>
						</div>
						<button
							type="button"
							aria-label="Đóng hộp thoại"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-lg p-2 hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
						>
							<X className="size-5" />
						</button>
					</header>

					<div className="space-y-6 p-6 max-h-[75vh] overflow-y-auto">
						{/* Weights Section */}
						<div className="rounded-xl border border-[#e0ebe0] bg-[#f8faf8] p-4 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="font-extrabold text-sm text-[#10221b]">
									1. Trọng số 5 tiêu chí thời tiết (Tổng phải đúng bằng 1.0)
								</h3>
								<span
									data-testid="weight-sum-indicator"
									className={`text-xs font-bold px-3 py-1 rounded-full ${
										Math.abs(currentWeightSum - 1.0) < 0.001
											? "bg-[#164027] text-white"
											: "bg-red-700 text-white"
									}`}
								>
									Tổng trọng số: {currentWeightSum} / 1.0
								</span>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
								<div>
									<label
										htmlFor="rule-weight-rainfall"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Mưa
									</label>
									<input
										id="rule-weight-rainfall"
										type="number"
										step="0.05"
										min="0"
										max="1"
										disabled={isSubmitting}
										{...register("rainfallWeight", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
									/>
								</div>
								<div>
									<label
										htmlFor="rule-weight-wind"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Gió
									</label>
									<input
										id="rule-weight-wind"
										type="number"
										step="0.05"
										min="0"
										max="1"
										disabled={isSubmitting}
										{...register("windWeight", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
									/>
								</div>
								<div>
									<label
										htmlFor="rule-weight-temp"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Nhiệt độ
									</label>
									<input
										id="rule-weight-temp"
										type="number"
										step="0.05"
										min="0"
										max="1"
										disabled={isSubmitting}
										{...register("temperatureWeight", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
									/>
								</div>
								<div>
									<label
										htmlFor="rule-weight-vis"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Tầm nhìn
									</label>
									<input
										id="rule-weight-vis"
										type="number"
										step="0.05"
										min="0"
										max="1"
										disabled={isSubmitting}
										{...register("visibilityWeight", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
									/>
								</div>
								<div>
									<label
										htmlFor="rule-weight-storm"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Dông sét
									</label>
									<input
										id="rule-weight-storm"
										type="number"
										step="0.05"
										min="0"
										max="1"
										disabled={isSubmitting}
										{...register("thunderstormWeight", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b] outline-none focus:border-[#164027]"
									/>
								</div>
							</div>
							{errors.rainfallWeight && (
								<p className="text-xs font-bold text-red-600">{errors.rainfallWeight.message}</p>
							)}
						</div>

						{/* Thresholds Section */}
						<div className="space-y-4">
							<h3 className="font-extrabold text-sm text-[#10221b]">
								2. Ngưỡng vi phạm các tiêu chí (Mức Vàng / Mức Đỏ)
							</h3>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{/* Rainfall thresholds */}
								<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
									<h4 className="text-xs font-bold text-[#10221b] uppercase">Lượng mưa (mm)</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label
												htmlFor="rule-rainfall-yellow"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Vàng (≥ mm)
											</label>
											<input
												id="rule-rainfall-yellow"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("rainfallYellowThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-rainfall-red"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Đỏ (≥ mm)
											</label>
											<input
												id="rule-rainfall-red"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("rainfallRedThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
									</div>
								</div>

								{/* Wind thresholds */}
								<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
									<h4 className="text-xs font-bold text-[#10221b] uppercase">Tốc độ gió (km/h)</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label
												htmlFor="rule-wind-yellow"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Vàng (≥ km/h)
											</label>
											<input
												id="rule-wind-yellow"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("windYellowThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-wind-red"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Đỏ (≥ km/h)
											</label>
											<input
												id="rule-wind-red"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("windRedThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
									</div>
								</div>

								{/* Temperature thresholds */}
								<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2 sm:col-span-2">
									<h4 className="text-xs font-bold text-[#10221b] uppercase">Nhiệt độ (°C)</h4>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
										<div>
											<label
												htmlFor="rule-temp-low-red"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Thấp Đỏ (&lt; °C)
											</label>
											<input
												id="rule-temp-low-red"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("tempLowRed", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-temp-low-yellow"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Thấp Vàng (≤ °C)
											</label>
											<input
												id="rule-temp-low-yellow"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("tempLowYellow", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-temp-high-yellow"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Cao Vàng (≥ °C)
											</label>
											<input
												id="rule-temp-high-yellow"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("tempHighYellow", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-temp-high-red"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Cao Đỏ (&gt; °C)
											</label>
											<input
												id="rule-temp-high-red"
												type="number"
												step="1"
												disabled={isSubmitting}
												{...register("tempHighRed", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
									</div>
								</div>

								{/* Visibility thresholds */}
								<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
									<h4 className="text-xs font-bold text-[#10221b] uppercase">Tầm nhìn xa (mét)</h4>
									<div className="grid grid-cols-2 gap-2">
										<div>
											<label
												htmlFor="rule-vis-yellow"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Vàng (≤ m)
											</label>
											<input
												id="rule-vis-yellow"
												type="number"
												step="500"
												disabled={isSubmitting}
												{...register("visibilityYellowThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
										<div>
											<label
												htmlFor="rule-vis-red"
												className="text-xs font-medium text-[#54655a] block mb-0.5"
											>
												Đỏ (≤ m)
											</label>
											<input
												id="rule-vis-red"
												type="number"
												step="500"
												disabled={isSubmitting}
												{...register("visibilityRedThreshold", { valueAsNumber: true })}
												className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
											/>
										</div>
									</div>
								</div>

								{/* Thunderstorm flags */}
								<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-3.5 space-y-2">
									<h4 className="text-xs font-bold text-[#10221b] uppercase">Hoạt động dông sét</h4>
									<div className="grid grid-cols-2 gap-2 pt-1">
										<label className="flex items-center gap-2 text-xs font-semibold text-[#10221b] cursor-pointer">
											<input
												type="checkbox"
												disabled={isSubmitting}
												{...register("thunderstormYellow")}
												className="size-4 text-[#164027] rounded"
											/>
											<span>Kích hoạt Vàng</span>
										</label>
										<label className="flex items-center gap-2 text-xs font-semibold text-[#10221b] cursor-pointer">
											<input
												type="checkbox"
												disabled={isSubmitting}
												{...register("thunderstormRed")}
												className="size-4 text-[#164027] rounded"
											/>
											<span>Kích hoạt Đỏ</span>
										</label>
									</div>
								</div>
							</div>
						</div>

						{/* Composite Score Bounds */}
						<div className="rounded-xl border border-[#e4ebe4] bg-[#fafcfb] p-4 space-y-3">
							<h3 className="font-extrabold text-sm text-[#10221b]">
								3. Thang điểm đánh giá rủi ro tổng hợp
							</h3>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<label
										htmlFor="rule-green-max-score"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Điểm trần Mức Xanh (Green Max)
									</label>
									<input
										id="rule-green-max-score"
										type="number"
										step="0.1"
										disabled={isSubmitting}
										{...register("greenMaxScore", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
									/>
								</div>
								<div>
									<label
										htmlFor="rule-yellow-max-score"
										className="text-xs font-semibold text-[#54655a] block mb-1"
									>
										Điểm trần Mức Vàng (Yellow Max)
									</label>
									<input
										id="rule-yellow-max-score"
										type="number"
										step="0.1"
										disabled={isSubmitting}
										{...register("yellowMaxScore", { valueAsNumber: true })}
										className="w-full rounded-lg border border-[#cbd9ce] px-2.5 py-1.5 text-xs font-bold text-[#10221b]"
									/>
								</div>
							</div>
						</div>

						{/* Form Validation Errors Summary */}
						{Object.keys(errors).length > 0 && (
							<div
								role="alert"
								className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 space-y-1"
							>
								<div className="flex items-center gap-1.5 text-red-800">
									<AlertCircle className="size-4 shrink-0" />
									<span>Vui lòng sửa các lỗi cấu hình sau:</span>
								</div>
								<ul className="list-disc list-inside pl-1 space-y-0.5 font-medium">
									{Object.entries(errors).map(([field, err]) => (
										<li key={field}>{err?.message?.toString()}</li>
									))}
								</ul>
							</div>
						)}
					</div>

					<footer className="flex justify-end gap-3 border-t border-[#e0ebe0] bg-[#f8faf7] p-4">
						<button
							type="button"
							onClick={onClose}
							disabled={isSubmitting}
							className="rounded-xl border px-5 py-2.5 text-xs font-bold border-gray-300 text-gray-700 hover:bg-gray-100 transition-colors"
						>
							Hủy
						</button>
						<button
							type="submit"
							data-testid="btn-save-rule"
							disabled={isSubmitting}
							className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition-all hover:bg-[#10301d] disabled:opacity-50 cursor-pointer"
						>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Đang lưu..." : "Lưu bộ quy tắc mới"}
						</button>
					</footer>
				</form>
			</dialog>
		</div>
	);
}
