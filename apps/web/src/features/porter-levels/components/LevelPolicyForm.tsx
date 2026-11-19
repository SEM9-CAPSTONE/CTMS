import { zodResolver } from "@hookform/resolvers/zod";
import { Award, Check, CheckSquare, Edit2, FileText, Shield, X } from "lucide-react";
import { useEffect, useState } from "react";
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

const PRESET_CERTIFICATIONS = [
	"Sơ cấp cứu nơi hoang dã (WFA)",
	"Kỹ thuật cứu hộ & Ứng phó khẩn cấp",
	"Thẻ hướng dẫn viên du lịch quốc tế/nội địa",
	"Chứng chỉ sinh tồn dã ngoại",
];

const PRESET_SKILLS = [
	"Dẫn đường & Định vị GPS/Bản đồ địa hình",
	"Quản lý an toàn đoàn & Đánh giá rủi ro thời tiết",
	"Xử lý sự cố y tế & Sơ cứu khẩn cấp dã ngoại",
	"Kỹ thuật vượt suối, dốc đứng & dây thừng",
	"Giao tiếp & Ứng xử với khách cắm trại",
];

export function LevelPolicyForm({ policy, pending, error, onSave }: Props) {
	// Mode: View (default if policy exists) vs Edit
	const [isEditing, setIsEditing] = useState(false);

	const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
	const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<LevelPolicyFormInput>({
		resolver: zodResolver(levelPolicySchema, undefined, { raw: true }),
		defaultValues: {
			name: policy?.definition.name ?? "",
			minExperienceYears: policy?.definition.minExperienceYears?.toString() ?? "",
			minTimesLed: policy?.definition.minTimesLed?.toString() ?? "",
			requiredSkills: policy?.definition.requiredSkills.join("\n") ?? "",
			requiredCertifications: policy?.definition.requiredCertifications.join("\n") ?? "",
			responsibilities:
				policy?.definition.responsibilities === "Chưa cấu hình phạm vi phụ trách."
					? ""
					: (policy?.definition.responsibilities ?? ""),
		},
	});

	// Synchronize preset checkboxes with form values
	useEffect(() => {
		if (policy) {
			const certs = policy.definition.requiredCertifications ?? [];
			const skills = policy.definition.requiredSkills ?? [];
			setSelectedCerts(PRESET_CERTIFICATIONS.filter((c) => certs.includes(c)));
			setSelectedSkills(PRESET_SKILLS.filter((s) => skills.includes(s)));
			reset({
				name: policy.definition.name ?? "",
				minExperienceYears: policy.definition.minExperienceYears?.toString() ?? "",
				minTimesLed: policy.definition.minTimesLed?.toString() ?? "",
				requiredSkills: skills.join("\n"),
				requiredCertifications: certs.join("\n"),
				responsibilities:
					policy.definition.responsibilities === "Chưa cấu hình phạm vi phụ trách."
						? ""
						: policy.definition.responsibilities,
			});
		}
	}, [policy, reset]);

	const toggleCertCheckbox = (certName: string) => {
		const next = selectedCerts.includes(certName)
			? selectedCerts.filter((c) => c !== certName)
			: [...selectedCerts, certName];
		setSelectedCerts(next);

		// Get current textarea certs that are not presets
		const currentLines = (watch("requiredCertifications") || "")
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l && !PRESET_CERTIFICATIONS.includes(l));

		const combined = [...next, ...currentLines];
		setValue("requiredCertifications", combined.join("\n"), { shouldValidate: true });
	};

	const toggleSkillCheckbox = (skillName: string) => {
		const next = selectedSkills.includes(skillName)
			? selectedSkills.filter((s) => s !== skillName)
			: [...selectedSkills, skillName];
		setSelectedSkills(next);

		// Get current textarea skills that are not presets
		const currentLines = (watch("requiredSkills") || "")
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l && !PRESET_SKILLS.includes(l));

		const combined = [...next, ...currentLines];
		setValue("requiredSkills", combined.join("\n"), { shouldValidate: true });
	};

	const onSubmitForm = async (data: LevelPolicyFormInput) => {
		try {
			await onSave({
				...levelPolicySchema.parse(data),
				expectedVersion: policy?.version ?? 0,
			});
			setIsEditing(false);
		} catch {
			/* mutation exposes error without clearing input */
		}
	};

	// =========================================================================
	// VIEW MODE: Read-only summary with "Chỉnh sửa" button
	// =========================================================================
	if (!isEditing && policy) {
		const def = policy.definition;
		return (
			<div className="space-y-5 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-5 shadow-2xs">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe8df] pb-4">
					<div>
						<h3 className="text-base font-extrabold text-[#10221b]">{def.name}</h3>
						<p className="mt-0.5 text-xs text-[#627769]">
							Phiên bản cấu hình: v{policy.version} · Cập nhật bởi Quản trị viên
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsEditing(true)}
						className="gap-2"
					>
						<Edit2 size={14} />
						<span>Chỉnh sửa tiêu chí</span>
					</Button>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="rounded-xl border border-[#dfe8df] bg-white p-4 shadow-2xs">
						<span className="text-xs font-semibold text-[#627769] block">
							Kinh nghiệm tối thiểu
						</span>
						<span className="mt-1 text-xl font-bold text-[#10221b] block">
							{def.minExperienceYears != null ? `${def.minExperienceYears} năm` : "Không yêu cầu"}
						</span>
					</div>

					<div className="rounded-xl border border-[#dfe8df] bg-white p-4 shadow-2xs">
						<span className="text-xs font-semibold text-[#627769] block">
							Số lần dẫn đoàn tối thiểu
						</span>
						<span className="mt-1 text-xl font-bold text-[#10221b] block">
							{def.minTimesLed != null ? `${def.minTimesLed} chuyến` : "Không yêu cầu"}
						</span>
					</div>
				</div>

				<div className="space-y-3 rounded-xl border border-[#dfe8df] bg-white p-4">
					<div className="flex items-center gap-2">
						<Shield className="size-4 text-[#164027]" />
						<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
							Chứng chỉ bắt buộc ({def.requiredCertifications.length})
						</h4>
					</div>
					{def.requiredCertifications.length === 0 ? (
						<p className="text-xs text-[#627769] italic">Không có yêu cầu chứng chỉ bắt buộc.</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{def.requiredCertifications.map((cert) => (
								<span
									key={cert}
									className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4d7c7] bg-[#f0f6f1] px-2.5 py-1 text-xs font-bold text-[#164027]"
								>
									<Check size={13} />
									<span>{cert}</span>
								</span>
							))}
						</div>
					)}
				</div>

				<div className="space-y-3 rounded-xl border border-[#dfe8df] bg-white p-4">
					<div className="flex items-center gap-2">
						<Award className="size-4 text-[#164027]" />
						<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
							Kỹ năng bắt buộc ({def.requiredSkills.length})
						</h4>
					</div>
					{def.requiredSkills.length === 0 ? (
						<p className="text-xs text-[#627769] italic">Không có yêu cầu kỹ năng bắt buộc.</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{def.requiredSkills.map((skill) => (
								<span
									key={skill}
									className="inline-flex items-center gap-1.5 rounded-lg border border-[#dfe8df] bg-[#fafcfa] px-2.5 py-1 text-xs font-semibold text-[#10221b]"
								>
									<span>• {skill}</span>
								</span>
							))}
						</div>
					)}
				</div>

				<div className="space-y-2 rounded-xl border border-[#dfe8df] bg-white p-4">
					<div className="flex items-center gap-2">
						<FileText className="size-4 text-[#164027]" />
						<h4 className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
							Phạm vi phụ trách
						</h4>
					</div>
					<p className="text-xs leading-relaxed text-[#55685a]">
						{def.responsibilities || "Chưa cấu hình phạm vi phụ trách."}
					</p>
				</div>
			</div>
		);
	}

	// =========================================================================
	// EDIT MODE: Form with Checkboxes & Direct Input
	// =========================================================================
	return (
		<form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
			<div className="flex items-center justify-between border-b border-[#dfe8df] pb-3">
				<div>
					<h3 className="text-base font-bold text-[#10221b]">
						{policy ? `Chỉnh sửa tiêu chí: ${policy.definition.name}` : "Thiết lập tiêu chí cấp độ"}
					</h3>
					<p className="text-xs text-[#627769]">
						Chọn các tiêu chí bằng hộp kiểm hoặc nhập thêm yêu cầu chi tiết bên dưới.
					</p>
				</div>
				{policy && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setIsEditing(false)}
						disabled={pending}
						className="gap-1.5"
					>
						<X size={14} />
						<span>Hủy bỏ</span>
					</Button>
				)}
			</div>

			{/* Basic Info */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<label className="block space-y-1 text-xs font-bold text-[#10221b]">
					Tên cấp
					<input
						className={LEVEL_INPUT_CLASS}
						type="text"
						disabled={pending}
						{...register("name")}
					/>
					{errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
				</label>

				<label className="block space-y-1 text-xs font-bold text-[#10221b]">
					Số năm kinh nghiệm tối thiểu
					<input
						className={LEVEL_INPUT_CLASS}
						type="number"
						min={0}
						step={1}
						disabled={pending}
						placeholder="Để trống nếu không yêu cầu"
						{...register("minExperienceYears")}
					/>
				</label>

				<label className="block space-y-1 text-xs font-bold text-[#10221b]">
					Số lần dẫn tuyến tối thiểu
					<input
						className={LEVEL_INPUT_CLASS}
						type="number"
						min={0}
						step={1}
						disabled={pending}
						placeholder="Để trống nếu không yêu cầu"
						{...register("minTimesLed")}
					/>
				</label>
			</div>

			{/* Required Certifications with Checkboxes */}
			<div className="rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4 space-y-3">
				<div className="flex items-center gap-2">
					<CheckSquare className="size-4 text-[#164027]" />
					<label className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
						Chứng chỉ chuyên môn bắt buộc
					</label>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					{PRESET_CERTIFICATIONS.map((cert) => {
						const isChecked = selectedCerts.includes(cert);
						return (
							<label
								key={cert}
								className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer transition select-none ${
									isChecked
										? "border-[#164027] bg-[#f0f6f1] text-[#164027]"
										: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f7faf7]"
								}`}
							>
								<input
									type="checkbox"
									checked={isChecked}
									onChange={() => toggleCertCheckbox(cert)}
									disabled={pending}
									className="size-4 rounded accent-[#164027]"
								/>
								<span>{cert}</span>
							</label>
						);
					})}
				</div>

				<label className="block space-y-1 text-xs text-[#627769] pt-2">
					<span className="font-bold text-[#10221b]">
						Danh sách đầy đủ (chọn hộp kiểm ở trên hoặc gõ thêm mỗi dòng 1 chứng chỉ):
					</span>
					<textarea
						rows={3}
						className={LEVEL_INPUT_CLASS}
						disabled={pending}
						placeholder="Nhập thêm chứng chỉ khác nếu có..."
						{...register("requiredCertifications")}
					/>
					{errors.requiredCertifications && (
						<span className="text-xs text-red-600">{errors.requiredCertifications.message}</span>
					)}
				</label>
			</div>

			{/* Required Skills with Checkboxes */}
			<div className="rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4 space-y-3">
				<div className="flex items-center gap-2">
					<CheckSquare className="size-4 text-[#164027]" />
					<label className="text-xs font-bold text-[#10221b] uppercase tracking-wider">
						Kỹ năng bắt buộc
					</label>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
					{PRESET_SKILLS.map((skill) => {
						const isChecked = selectedSkills.includes(skill);
						return (
							<label
								key={skill}
								className={`flex items-center gap-2.5 rounded-xl border p-2.5 text-xs font-semibold cursor-pointer transition select-none ${
									isChecked
										? "border-[#164027] bg-[#f0f6f1] text-[#164027]"
										: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f7faf7]"
								}`}
							>
								<input
									type="checkbox"
									checked={isChecked}
									onChange={() => toggleSkillCheckbox(skill)}
									disabled={pending}
									className="size-4 rounded accent-[#164027]"
								/>
								<span>{skill}</span>
							</label>
						);
					})}
				</div>

				<label className="block space-y-1 text-xs text-[#627769] pt-2">
					<span className="font-bold text-[#10221b]">
						Danh sách đầy đủ (chọn hộp kiểm ở trên hoặc gõ thêm mỗi dòng 1 kỹ năng):
					</span>
					<textarea
						rows={3}
						className={LEVEL_INPUT_CLASS}
						disabled={pending}
						placeholder="Nhập thêm kỹ năng khác nếu có..."
						{...register("requiredSkills")}
					/>
					{errors.requiredSkills && (
						<span className="text-xs text-red-600">{errors.requiredSkills.message}</span>
					)}
				</label>
			</div>

			{/* Responsibilities */}
			<label className="block space-y-1 text-xs font-bold text-[#10221b]">
				Phạm vi phụ trách
				<textarea
					rows={3}
					className={LEVEL_INPUT_CLASS}
					disabled={pending}
					placeholder="Mô tả phạm vi trách nhiệm của cấp độ này..."
					{...register("responsibilities")}
				/>
				{errors.responsibilities && (
					<span className="text-xs text-red-600">{errors.responsibilities.message}</span>
				)}
			</label>

			{Boolean(error) && (
				<p role="alert" className="text-xs font-bold text-red-700">
					{levelReviewError(error)}
				</p>
			)}

			<div className="flex items-center gap-3 pt-3">
				<Button type="submit" disabled={pending} className="gap-2">
					<Check size={15} />
					<span>{pending ? "Đang lưu…" : "Lưu tiêu chí"}</span>
				</Button>
				{policy && (
					<Button
						type="button"
						variant="outline"
						onClick={() => setIsEditing(false)}
						disabled={pending}
					>
						Hủy bỏ
					</Button>
				)}
			</div>
		</form>
	);
}
