import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelReviewError } from "../constants";
import { type LevelPolicyFormInput, levelPolicySchema } from "../schema/level-policy.schema";
import type { LevelDefinition, LevelPolicy } from "../types";

interface Props {
	policy: LevelPolicy | null;
	pending: boolean;
	error: unknown;
	onSave: (data: LevelDefinition & { expectedVersion: number }) => Promise<unknown>;
}
const FIELDS = [
	{ key: "name", label: "Tên cấp" },
	{ key: "minExperienceYears", label: "Số năm kinh nghiệm tối thiểu" },
	{ key: "minTimesLed", label: "Số lần dẫn tuyến tối thiểu" },
	{ key: "requiredSkills", label: "Kỹ năng bắt buộc (mỗi dòng một mục)" },
	{ key: "requiredCertifications", label: "Chứng chỉ bắt buộc (mỗi dòng một mục)" },
	{ key: "responsibilities", label: "Phạm vi phụ trách" },
] as const;

export function LevelPolicyForm({ policy, pending, error, onSave }: Props) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<LevelPolicyFormInput>({
		resolver: zodResolver(levelPolicySchema, undefined, { raw: true }),
		defaultValues: {
			name: policy?.definition.name ?? "",
			minExperienceYears: policy?.definition.minExperienceYears?.toString() ?? "",
			minTimesLed: policy?.definition.minTimesLed?.toString() ?? "",
			requiredSkills: policy?.definition.requiredSkills.join("\n") ?? "",
			requiredCertifications: policy?.definition.requiredCertifications.join("\n") ?? "",
			responsibilities: policy?.definition.responsibilities ?? "",
		},
	});
	return (
		<form
			onSubmit={handleSubmit(async (data) => {
				try {
					await onSave({ ...levelPolicySchema.parse(data), expectedVersion: policy?.version ?? 0 });
				} catch {
					/* mutation exposes error without clearing input */
				}
			})}
			className="space-y-4"
		>
			<p className="text-sm text-[#627769]">
				{policy ? `Tiêu chí phiên bản ${policy.version}` : "Chưa cấu hình tiêu chí cho cấp này."} Ô
				số để trống nghĩa là chưa đặt điều kiện đó.
			</p>
			{FIELDS.map(({ key, label }) => (
				<label key={key} className="block space-y-1 text-sm font-semibold">
					{label}
					{key === "name" || key === "minExperienceYears" || key === "minTimesLed" ? (
						<input
							className={LEVEL_INPUT_CLASS}
							type={key === "name" ? "text" : "number"}
							min={key === "name" ? undefined : 0}
							step={1}
							disabled={pending}
							{...register(key)}
						/>
					) : (
						<textarea
							rows={3}
							className={LEVEL_INPUT_CLASS}
							disabled={pending}
							{...register(key)}
						/>
					)}
					{errors[key] && (
						<span role="alert" className="text-red-700">
							{errors[key]?.message}
						</span>
					)}
				</label>
			))}
			{Boolean(error) && (
				<p role="alert" className="text-red-700">
					{levelReviewError(error)}
				</p>
			)}
			<Button type="submit" disabled={pending}>
				{pending ? "Đang lưu…" : "Lưu tiêu chí"}
			</Button>
		</form>
	);
}
