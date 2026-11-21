import type { UseFormReturn } from "react-hook-form";
import type { HealthProfileFormValues } from "../schema/health-profile.schema";

export function ActivityProfileFields({
	form,
	disabled,
}: {
	form: UseFormReturn<HealthProfileFormValues>;
	disabled: boolean;
}) {
	const numeric = (value: unknown) =>
		value === "" || value === null || value === undefined ? null : Number(value);
	const error = form.formState.errors.activityProfile;
	return (
		<section
			className="flex flex-col gap-5 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm"
			aria-labelledby="activity-profile-title"
		>
			<div className="border-b border-[#f0f4f1] pb-3">
				<h3 id="activity-profile-title" className="text-base font-extrabold text-[#164027]">
					Khả năng vận động để chọn chuyến
				</h3>
			</div>
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
				{[
					{
						name: "comfortableDistanceKm" as const,
						label: "Quãng đường đi bộ quen thuộc (km/ngày)",
						min: 0,
						max: 200,
						step: 0.1,
					},
					{
						name: "comfortableWalkingMinutes" as const,
						label: "Thời gian đi bộ quen thuộc (phút/ngày)",
						min: 0,
						max: 1440,
						step: 1,
					},
				].map((field) => (
					<label key={field.name} className="flex flex-col gap-1.5">
						<span className="text-xs font-bold text-[#10221b]">{field.label}</span>
						<input
							type="number"
							min={field.min}
							max={field.max}
							step={field.step}
							disabled={disabled}
							className="h-10 w-full rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
							{...form.register(`activityProfile.${field.name}`, { setValueAs: numeric })}
						/>
						{error?.[field.name] && (
							<span className="text-xs text-red-700">
								Vui lòng nhập số trong khoảng {field.min}–{field.max}.
							</span>
						)}
					</label>
				))}
			</div>
			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-bold text-[#10221b]">Lưu ý khi vận động</span>
				<textarea
					disabled={disabled}
					rows={2}
					maxLength={1200}
					className="w-full resize-none rounded-xl border border-[#dfe8df] bg-white p-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:cursor-not-allowed disabled:bg-gray-100"
					{...form.register("activityProfile.activityNotes")}
				/>
				{error?.activityNotes && (
					<span className="text-xs text-red-700">{error.activityNotes.message}</span>
				)}
			</label>
		</section>
	);
}
