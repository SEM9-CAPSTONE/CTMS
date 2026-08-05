import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { CamperProfileFormValues } from "../schema/profile.schema";
import type { LanguageItem } from "../types";

interface ExperienceSkillsFormProps {
	form: UseFormReturn<CamperProfileFormValues>;
	languages: LanguageItem[];
	onAddLanguage: (name: string) => void;
	onRemoveLanguage: (id: string) => void;
}

export function ExperienceSkillsForm({
	form,
	languages,
	onAddLanguage,
	onRemoveLanguage,
}: ExperienceSkillsFormProps) {
	const {
		register,
		formState: { errors },
	} = form;

	const [newLangInput, setNewLangInput] = useState<string>("");

	const handleAddClick = () => {
		if (newLangInput.trim()) {
			onAddLanguage(newLangInput.trim());
			setNewLangInput("");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleAddClick();
		}
	};

	return (
		<div className="flex flex-col gap-6 rounded-2xl border border-[#e0ebe0] bg-white p-6 shadow-sm">
			<div className="border-b border-[#f0f4f1] pb-3">
				<h3 className="text-base font-extrabold text-[#164027]">Kinh nghiệm & Ngôn ngữ</h3>
				<p className="text-xs font-medium text-[#627769]">
					Thông tin hỗ trợ Host và Porter đánh giá năng lực thể chất và khả năng giao tiếp của bạn.
				</p>
			</div>

			<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
				{/* Camping Experience Years */}
				<div className="flex flex-col gap-1.5">
					<label htmlFor="campingExperienceYears" className="text-xs font-bold text-[#10221b]">
						Số năm kinh nghiệm cắm trại (năm)
					</label>
					<input
						id="campingExperienceYears"
						type="number"
						{...register("campingExperienceYears", { valueAsNumber: true })}
						className="h-10 rounded-xl border border-[#dfe8df] bg-white px-3.5 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10"
						placeholder="Ví dụ: 5"
					/>
					{errors.campingExperienceYears && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.campingExperienceYears.message}
						</span>
					)}
				</div>

				{/* Trekking Experience Details */}
				<div className="flex flex-col gap-1.5 sm:col-span-2">
					<label htmlFor="trekkingExperienceDetails" className="text-xs font-bold text-[#10221b]">
						Chi tiết kinh nghiệm trekking / leo núi
					</label>
					<textarea
						id="trekkingExperienceDetails"
						rows={2}
						{...register("trekkingExperienceDetails")}
						className="rounded-xl border border-[#dfe8df] bg-white p-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 resize-none"
						placeholder="Liệt kê các cung đường hoặc đỉnh núi bạn từng hoàn thành..."
					/>
					{errors.trekkingExperienceDetails && (
						<span className="text-[11px] font-semibold text-red-500">
							{errors.trekkingExperienceDetails.message}
						</span>
					)}
				</div>

				{/* Languages */}
				<div className="flex flex-col gap-2.5 sm:col-span-2">
					<label className="text-xs font-bold text-[#10221b]">Ngôn ngữ giao tiếp</label>
					<div className="flex flex-wrap items-center gap-2">
						{languages.map((lang) => (
							<span
								key={lang.id}
								className="inline-flex items-center gap-1.5 rounded-full bg-[#eef7f0] border border-[#d2e8d6] px-3 py-1 text-xs font-bold text-[#164027]"
							>
								<span>{lang.name}</span>
								<button
									type="button"
									onClick={() => onRemoveLanguage(lang.id)}
									className="rounded-full p-0.5 hover:bg-[#d8edd9] text-[#164027] transition"
									aria-label={`Xóa ngôn ngữ ${lang.name}`}
								>
									<X size={12} />
								</button>
							</span>
						))}
					</div>

					<div className="flex items-center gap-2 mt-1 max-w-sm">
						<input
							type="text"
							value={newLangInput}
							onChange={(e) => setNewLangInput(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="Thêm ngôn ngữ (ví dụ: Tiếng Nhật)"
							className="h-9 flex-1 rounded-xl border border-[#dfe8df] bg-white px-3 text-xs text-[#10221b] outline-none transition focus:border-[#164027]"
						/>
						<button
							type="button"
							onClick={handleAddClick}
							className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-[#164027] px-3 text-xs font-bold text-white hover:bg-[#276143] transition"
						>
							<Plus size={14} />
							<span>Thêm</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
