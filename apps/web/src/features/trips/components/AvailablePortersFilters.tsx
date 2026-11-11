import type { IntendedPorterRole } from "../types";

interface AvailablePortersFiltersProps {
	role: IntendedPorterRole | null;
	experienceInput: string;
	experienceError: string | null;
	onRoleChange: (role: IntendedPorterRole) => void;
	onExperienceChange: (value: string) => void;
}

export function AvailablePortersFilters({
	role,
	experienceInput,
	experienceError,
	onRoleChange,
	onExperienceChange,
}: AvailablePortersFiltersProps) {
	return (
		<div className="mt-5 space-y-3">
			<label className="block text-xs font-bold text-[#55685a]">
				Vai trò Porter
				<select
					value={role ?? ""}
					onChange={(event) => onRoleChange(event.target.value as IntendedPorterRole)}
					className="mt-1 w-full rounded-xl border border-[#dfe8df] bg-white px-3 py-2.5 text-sm text-[#10221b] outline-none focus:border-[#164027]"
				>
					<option value="" disabled>
						Chọn vai trò
					</option>
					<option value="lead">Trưởng đoàn</option>
					<option value="support">Hỗ trợ</option>
				</select>
			</label>
			<label className="block text-xs font-bold text-[#55685a]">
				Kinh nghiệm tối thiểu (năm)
				<input
					type="number"
					min="0"
					step="1"
					value={experienceInput}
					onChange={(event) => onExperienceChange(event.target.value)}
					placeholder="Không giới hạn"
					aria-invalid={experienceError !== null}
					aria-describedby={experienceError ? "available-porters-experience-error" : undefined}
					className="mt-1 w-full rounded-xl border border-[#dfe8df] px-3 py-2.5 text-sm text-[#10221b] outline-none focus:border-[#164027]"
				/>
			</label>
			{experienceError && (
				<p id="available-porters-experience-error" className="text-xs font-semibold text-rose-700">
					{experienceError}
				</p>
			)}
		</div>
	);
}
