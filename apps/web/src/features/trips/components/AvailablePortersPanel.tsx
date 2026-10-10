import { Search, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { IntendedPorterRole } from "../types";
import { AvailablePortersFilters } from "./AvailablePortersFilters";
import { AvailablePortersResults } from "./AvailablePortersResults";

interface AvailablePortersPanelProps {
	tripId: string;
}

function parseExperience(value: string): { value?: number; error: string | null } {
	if (value === "") return { value: undefined, error: null };
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		return { error: "Kinh nghiệm tối thiểu phải là số nguyên từ 0 trở lên." };
	}
	return { value: parsed, error: null };
}

export function AvailablePortersPanel({ tripId }: AvailablePortersPanelProps) {
	const [role, setRole] = useState<IntendedPorterRole | null>(null);
	const [experienceInput, setExperienceInput] = useState("");
	const experience = useMemo(() => parseExperience(experienceInput), [experienceInput]);

	return (
		<section
			data-testid="available-porters-panel"
			className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
					<Users className="size-5" />
				</div>
				<div>
					<h3 className="text-base font-extrabold text-[#10221b]">Porter phù hợp</h3>
					<p className="mt-1 text-xs leading-5 text-[#667a6d]">
						Chọn vai trò để xem Porter hiện đáp ứng điều kiện của chuyến đi.
					</p>
				</div>
			</div>

			<AvailablePortersFilters
				role={role}
				experienceInput={experienceInput}
				experienceError={experience.error}
				onRoleChange={setRole}
				onExperienceChange={setExperienceInput}
			/>

			{role === null && (
				<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9cd] bg-[#f8faf8] p-5 text-center text-xs text-[#667a6d]">
					<Search className="mx-auto mb-2 size-5 text-[#164027]" />
					Chọn vai trò để bắt đầu tìm Porter.
				</div>
			)}

			{role !== null && !experience.error && (
				<AvailablePortersResults
					key={`${role}:${experience.value ?? "all"}`}
					tripId={tripId}
					role={role}
					minExperienceYears={experience.value}
				/>
			)}

			<p className="mt-5 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900">
				Khả dụng của Porter sẽ được kiểm tra lại khi tạo yêu cầu hoặc phân công.
			</p>
		</section>
	);
}
