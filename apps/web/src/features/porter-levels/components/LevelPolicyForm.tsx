import { zodResolver } from "@hookform/resolvers/zod";
import { Award, Check, CheckSquare, Edit2, FileText, Plus, Shield, Trash2, X } from "lucide-react";
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

interface CertOption {
	code: string;
	label: string;
}

const CERT_CATALOG_KEY = "ctms_porter_policy_cert_catalog_v1";
const SKILL_CATALOG_KEY = "ctms_porter_policy_skill_catalog_v1";

const DEFAULT_CERT_OPTIONS: CertOption[] = [
	{ code: "wfa", label: "Sơ cứu nơi hoang dã (WFA)" },
	{ code: "rescue", label: "Cứu hộ địa hình / Leo núi" },
	{ code: "guide_card", label: "Thẻ hướng dẫn viên du lịch" },
];

const DEFAULT_SKILL_OPTIONS: string[] = [
	"Dẫn đường & Định vị GPS/Bản đồ địa hình",
	"Quản lý an toàn đoàn & Đánh giá rủi ro thời tiết",
	"Xử lý sự cố y tế & Sơ cứu khẩn cấp dã ngoại",
	"Kỹ thuật vượt suối, dốc đứng & dây thừng",
	"Giao tiếp & Ứng xử với khách cắm trại",
];

function loadCertCatalog(policyCerts: string[]): CertOption[] {
	let stored: CertOption[] = DEFAULT_CERT_OPTIONS;
	try {
		const raw = window.localStorage.getItem(CERT_CATALOG_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as CertOption[];
			if (Array.isArray(parsed)) stored = parsed;
		}
	} catch {
		stored = DEFAULT_CERT_OPTIONS;
	}
	const existingCodes = new Set(stored.map((c) => c.code.toLowerCase()));
	const merged = [...stored];
	for (const code of policyCerts) {
		const trimmed = code.trim();
		if (trimmed && !existingCodes.has(trimmed.toLowerCase())) {
			const preset = DEFAULT_CERT_OPTIONS.find((p) => p.code === trimmed.toLowerCase());
			merged.push({ code: trimmed, label: preset?.label ?? trimmed });
			existingCodes.add(trimmed.toLowerCase());
		}
	}
	return merged;
}

function loadSkillCatalog(policySkills: string[]): string[] {
	let stored: string[] = DEFAULT_SKILL_OPTIONS;
	try {
		const raw = window.localStorage.getItem(SKILL_CATALOG_KEY);
		if (raw) {
			const parsed = JSON.parse(raw) as string[];
			if (Array.isArray(parsed)) stored = parsed;
		}
	} catch {
		stored = DEFAULT_SKILL_OPTIONS;
	}
	const existing = new Set(stored.map((s) => s.toLowerCase()));
	const merged = [...stored];
	for (const skill of policySkills) {
		const trimmed = skill.trim();
		if (trimmed && !existing.has(trimmed.toLowerCase())) {
			merged.push(trimmed);
			existing.add(trimmed.toLowerCase());
		}
	}
	return merged;
}

function saveCertCatalog(items: CertOption[]) {
	try {
		window.localStorage.setItem(CERT_CATALOG_KEY, JSON.stringify(items));
	} catch {
		/* ignore storage quota errors */
	}
}

function saveSkillCatalog(items: string[]) {
	try {
		window.localStorage.setItem(SKILL_CATALOG_KEY, JSON.stringify(items));
	} catch {
		/* ignore storage quota errors */
	}
}

function certDisplayLabel(codeOrName: string, catalog: CertOption[]): string {
	const lower = codeOrName.trim().toLowerCase();
	return (
		catalog.find((c) => c.code.toLowerCase() === lower)?.label ??
		DEFAULT_CERT_OPTIONS.find((c) => c.code === lower)?.label ??
		codeOrName
	);
}

export function LevelPolicyForm({ policy, pending, error, onSave }: Props) {
	const [isEditing, setIsEditing] = useState(false);

	const [certCatalog, setCertCatalog] = useState<CertOption[]>(() =>
		loadCertCatalog(policy?.definition.requiredCertifications ?? [])
	);
	const [skillCatalog, setSkillCatalog] = useState<string[]>(() =>
		loadSkillCatalog(policy?.definition.requiredSkills ?? [])
	);

	const [newCertInput, setNewCertInput] = useState("");
	const [editingCertCode, setEditingCertCode] = useState<string | null>(null);
	const [editingCertLabel, setEditingCertLabel] = useState("");

	const [newSkillInput, setNewSkillInput] = useState("");
	const [editingSkillOrig, setEditingSkillOrig] = useState<string | null>(null);
	const [editingSkillLabel, setEditingSkillLabel] = useState("");

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
			minCompletedTrips:
				(policy?.definition.minCompletedTrips ?? policy?.definition.minTimesLed)?.toString() ?? "",
			minTotalKm: policy?.definition.minTotalKm?.toString() ?? "",
			minAverageRating: policy?.definition.minAverageRating?.toString() ?? "",
			requiredSkills: policy?.definition.requiredSkills.join("\n") ?? "",
			requiredCertifications: policy?.definition.requiredCertifications.join("\n") ?? "",
			responsibilities:
				policy?.definition.responsibilities === "Chưa cấu hình phạm vi phụ trách."
					? ""
					: (policy?.definition.responsibilities ?? ""),
		},
	});

	useEffect(() => {
		if (policy) {
			const certs = policy.definition.requiredCertifications ?? [];
			const skills = policy.definition.requiredSkills ?? [];
			setCertCatalog(loadCertCatalog(certs));
			setSkillCatalog(loadSkillCatalog(skills));
			reset({
				name: policy.definition.name ?? "",
				minExperienceYears: policy.definition.minExperienceYears?.toString() ?? "",
				minTimesLed: policy.definition.minTimesLed?.toString() ?? "",
				minCompletedTrips:
					(policy.definition.minCompletedTrips ?? policy.definition.minTimesLed)?.toString() ?? "",
				minTotalKm: policy.definition.minTotalKm?.toString() ?? "",
				minAverageRating: policy.definition.minAverageRating?.toString() ?? "",
				requiredSkills: skills.join("\n"),
				requiredCertifications: certs.join("\n"),
				responsibilities:
					policy.definition.responsibilities === "Chưa cấu hình phạm vi phụ trách."
						? ""
						: policy.definition.responsibilities,
			});
		}
	}, [policy, reset]);

	const selectedCertCodes = (watch("requiredCertifications") || "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	const selectedSkills = (watch("requiredSkills") || "")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);

	const setSelectedCertCodes = (next: string[]) => {
		const unique = Array.from(new Set(next.map((s) => s.trim()).filter(Boolean)));
		setValue("requiredCertifications", unique.join("\n"), { shouldValidate: true });
	};

	const setSelectedSkills = (next: string[]) => {
		const unique = Array.from(new Set(next.map((s) => s.trim()).filter(Boolean)));
		setValue("requiredSkills", unique.join("\n"), { shouldValidate: true });
	};

	// --- Certification catalog CRUD ---
	const toggleCert = (code: string) => {
		if (selectedCertCodes.includes(code)) {
			setSelectedCertCodes(selectedCertCodes.filter((c) => c !== code));
		} else {
			setSelectedCertCodes([...selectedCertCodes, code]);
		}
	};

	const handleAddCert = () => {
		const label = newCertInput.trim();
		if (!label) return;
		const exists = certCatalog.some(
			(c) =>
				c.label.toLowerCase() === label.toLowerCase() ||
				c.code.toLowerCase() === label.toLowerCase()
		);
		if (!exists) {
			const nextCatalog = [...certCatalog, { code: label, label }];
			setCertCatalog(nextCatalog);
			saveCertCatalog(nextCatalog);
		}
		if (!selectedCertCodes.includes(label)) {
			setSelectedCertCodes([...selectedCertCodes, label]);
		}
		setNewCertInput("");
	};

	const handleSaveCertEdit = (origCode: string) => {
		const nextLabel = editingCertLabel.trim();
		if (!nextLabel) {
			handleDeleteCert(origCode);
			setEditingCertCode(null);
			return;
		}
		const isPresetCode = DEFAULT_CERT_OPTIONS.some((p) => p.code === origCode);
		const nextCode = isPresetCode ? origCode : nextLabel;
		const nextCatalog = certCatalog.map((item) =>
			item.code === origCode ? { code: nextCode, label: nextLabel } : item
		);
		setCertCatalog(nextCatalog);
		saveCertCatalog(nextCatalog);
		if (!isPresetCode && selectedCertCodes.includes(origCode)) {
			setSelectedCertCodes(selectedCertCodes.map((c) => (c === origCode ? nextCode : c)));
		}
		setEditingCertCode(null);
		setEditingCertLabel("");
	};

	const handleDeleteCert = (code: string) => {
		const nextCatalog = certCatalog.filter((item) => item.code !== code);
		setCertCatalog(nextCatalog);
		saveCertCatalog(nextCatalog);
		if (selectedCertCodes.includes(code)) {
			setSelectedCertCodes(selectedCertCodes.filter((c) => c !== code));
		}
	};

	// --- Skill catalog CRUD ---
	const toggleSkill = (skill: string) => {
		if (selectedSkills.includes(skill)) {
			setSelectedSkills(selectedSkills.filter((s) => s !== skill));
		} else {
			setSelectedSkills([...selectedSkills, skill]);
		}
	};

	const handleAddSkill = () => {
		const label = newSkillInput.trim();
		if (!label) return;
		const exists = skillCatalog.some((s) => s.toLowerCase() === label.toLowerCase());
		if (!exists) {
			const nextCatalog = [...skillCatalog, label];
			setSkillCatalog(nextCatalog);
			saveSkillCatalog(nextCatalog);
		}
		if (!selectedSkills.includes(label)) {
			setSelectedSkills([...selectedSkills, label]);
		}
		setNewSkillInput("");
	};

	const handleSaveSkillEdit = (origSkill: string) => {
		const nextLabel = editingSkillLabel.trim();
		if (!nextLabel) {
			handleDeleteSkill(origSkill);
			setEditingSkillOrig(null);
			return;
		}
		const nextCatalog = skillCatalog.map((item) => (item === origSkill ? nextLabel : item));
		setSkillCatalog(nextCatalog);
		saveSkillCatalog(nextCatalog);
		if (selectedSkills.includes(origSkill)) {
			setSelectedSkills(selectedSkills.map((s) => (s === origSkill ? nextLabel : s)));
		}
		setEditingSkillOrig(null);
		setEditingSkillLabel("");
	};

	const handleDeleteSkill = (skill: string) => {
		const nextCatalog = skillCatalog.filter((item) => item !== skill);
		setSkillCatalog(nextCatalog);
		saveSkillCatalog(nextCatalog);
		if (selectedSkills.includes(skill)) {
			setSelectedSkills(selectedSkills.filter((s) => s !== skill));
		}
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
	// VIEW MODE
	// =========================================================================
	if (!isEditing && policy) {
		const def = policy.definition;
		return (
			<div className="space-y-5 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-5 shadow-2xs">
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe8df] pb-4">
					<div>
						<h3 className="text-base font-extrabold text-[#10221b]">{def.name}</h3>
						<p className="mt-0.5 text-xs text-[#627769]">Cập nhật bởi Quản trị viên</p>
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

				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<div className="rounded-xl bg-white p-4">
						<span className="block text-xs font-medium text-[#627769]">
							Tổng số chuyến hoàn thành
						</span>
						<span className="mt-1 block text-xl font-bold text-[#10221b]">
							{(def.minCompletedTrips ?? def.minTimesLed) != null
								? `${def.minCompletedTrips ?? def.minTimesLed} chuyến`
								: "Không yêu cầu"}
						</span>
					</div>

					<div className="rounded-xl bg-white p-4">
						<span className="block text-xs font-medium text-[#627769]">
							Tổng quãng đường đã dẫn
						</span>
						<span className="mt-1 block text-xl font-bold text-[#10221b]">
							{def.minTotalKm != null ? `${def.minTotalKm} km` : "Không yêu cầu"}
						</span>
					</div>

					<div className="rounded-xl bg-white p-4">
						<span className="block text-xs font-medium text-[#627769]">
							Điểm đánh giá trung bình
						</span>
						<span className="mt-1 block text-xl font-bold text-[#10221b]">
							{def.minAverageRating != null ? `>= ${def.minAverageRating}★` : "Không yêu cầu"}
						</span>
					</div>

					<div className="rounded-xl bg-white p-4">
						<span className="block text-xs font-medium text-[#627769]">
							Kinh nghiệm (không bắt buộc)
						</span>
						<span className="mt-1 block text-xl font-bold text-[#10221b]">
							{def.minExperienceYears != null && def.minExperienceYears > 0
								? `${def.minExperienceYears} năm`
								: "Không bắt buộc"}
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
									<span>{certDisplayLabel(cert, certCatalog)}</span>
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
	// EDIT MODE: Unified Editable Checkboxes + Inline Add / Edit / Delete
	// =========================================================================
	return (
		<form onSubmit={handleSubmit(onSubmitForm)} className="space-y-5">
			<div className="flex items-center justify-between border-b border-[#dfe8df] pb-3">
				<div>
					<h3 className="text-base font-bold text-[#10221b]">
						{policy ? `Chỉnh sửa tiêu chí: ${policy.definition.name}` : "Thiết lập tiêu chí cấp độ"}
					</h3>
					<p className="text-xs text-[#627769]">
						Tick chọn, sửa, xóa hoặc thêm mới chứng chỉ và kỹ năng áp dụng cho cấp bậc này.
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

			{/* Basic Metrics */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
					Tổng chuyến hoàn thành
					<input
						className={LEVEL_INPUT_CLASS}
						type="number"
						min={0}
						step={1}
						disabled={pending}
						placeholder="VD: 10"
						{...register("minCompletedTrips")}
					/>
				</label>

				<label className="block space-y-1 text-xs font-bold text-[#10221b]">
					Tổng km đã dẫn
					<input
						className={LEVEL_INPUT_CLASS}
						type="number"
						min={0}
						step={1}
						disabled={pending}
						placeholder="VD: 100"
						{...register("minTotalKm")}
					/>
				</label>

				<label className="block space-y-1 text-xs font-bold text-[#10221b]">
					Điểm đánh giá tối thiểu
					<input
						className={LEVEL_INPUT_CLASS}
						type="number"
						min={0}
						max={5}
						step={0.1}
						disabled={pending}
						placeholder="VD: 4.2"
						{...register("minAverageRating")}
					/>
				</label>

				<div className="space-y-1">
					<label className="block space-y-1 text-xs font-bold text-[#10221b]">
						Số năm kinh nghiệm tối thiểu
						<input
							className={LEVEL_INPUT_CLASS}
							type="number"
							min={0}
							step={1}
							disabled={pending}
							placeholder="Không bắt buộc"
							{...register("minExperienceYears")}
						/>
					</label>
					<p className="text-[11px] text-[#667a6d]">Điều kiện tham khảo, không bắt buộc</p>
				</div>
			</div>

			{/* Required Certifications — Unified Editable Checkboxes */}
			<div className="space-y-3 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<CheckSquare className="size-4 text-[#164027]" />
						<span className="text-xs font-bold uppercase tracking-wider text-[#10221b]">
							Chứng chỉ chuyên môn bắt buộc ({selectedCertCodes.length})
						</span>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
					{certCatalog.map((cert) => {
						const isChecked = selectedCertCodes.includes(cert.code);
						const isItemEditing = editingCertCode === cert.code;
						return (
							<div
								key={cert.code}
								className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
									isChecked
										? "border-[#164027] bg-[#f0f6f1] text-[#164027]"
										: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f7faf7]"
								}`}
							>
								{isItemEditing ? (
									<div className="flex flex-1 items-center gap-1.5">
										<input
											type="text"
											value={editingCertLabel}
											onChange={(e) => setEditingCertLabel(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleSaveCertEdit(cert.code);
												}
											}}
											aria-label="Sửa tên chứng chỉ"
											className="h-7 flex-1 rounded-lg border border-[#164027] bg-white px-2 text-xs text-[#10221b] focus:outline-hidden"
										/>
										<button
											type="button"
											onClick={() => handleSaveCertEdit(cert.code)}
											aria-label="Lưu chứng chỉ"
											className="rounded-lg bg-[#164027] p-1 text-white hover:bg-[#1f5635]"
										>
											<Check size={13} />
										</button>
										<button
											type="button"
											onClick={() => setEditingCertCode(null)}
											aria-label="Hủy sửa chứng chỉ"
											className="rounded-lg p-1 text-[#667a6d] hover:bg-[#edf2ed]"
										>
											<X size={13} />
										</button>
									</div>
								) : (
									<>
										<label className="flex flex-1 cursor-pointer select-none items-center gap-2.5 font-semibold">
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => toggleCert(cert.code)}
												disabled={pending}
												className="size-4 shrink-0 rounded accent-[#164027]"
											/>
											<span className="leading-snug">{cert.label}</span>
										</label>
										<div className="flex shrink-0 items-center gap-0.5">
											<button
												type="button"
												disabled={pending}
												onClick={() => {
													setEditingCertCode(cert.code);
													setEditingCertLabel(cert.label);
												}}
												aria-label={`Sửa chứng chỉ ${cert.label}`}
												className="rounded-lg p-1 text-[#53674d] transition-colors hover:bg-white hover:text-[#164027]"
											>
												<Edit2 size={13} />
											</button>
											<button
												type="button"
												disabled={pending}
												onClick={() => handleDeleteCert(cert.code)}
												aria-label={`Xóa chứng chỉ ${cert.label}`}
												className="rounded-lg p-1 text-[#667a6d] transition-colors hover:bg-rose-50 hover:text-rose-700"
											>
												<Trash2 size={13} />
											</button>
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>

				<div className="flex items-center gap-2 pt-1">
					<input
						type="text"
						value={newCertInput}
						onChange={(e) => setNewCertInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddCert();
							}
						}}
						disabled={pending}
						placeholder="Nhập tên chứng chỉ mới để thêm vào danh sách chọn..."
						aria-label="Thêm chứng chỉ mới"
						className={`${LEVEL_INPUT_CLASS} flex-1`}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pending || !newCertInput.trim()}
						onClick={handleAddCert}
						className="shrink-0 gap-1"
					>
						<Plus size={14} />
						<span>Thêm</span>
					</Button>
				</div>
				<input type="hidden" {...register("requiredCertifications")} />
				{errors.requiredCertifications && (
					<span className="text-xs text-red-600">{errors.requiredCertifications.message}</span>
				)}
			</div>

			{/* Required Skills — Unified Editable Checkboxes */}
			<div className="space-y-3 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<CheckSquare className="size-4 text-[#164027]" />
						<span className="text-xs font-bold uppercase tracking-wider text-[#10221b]">
							Kỹ năng bắt buộc ({selectedSkills.length})
						</span>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					{skillCatalog.map((skill) => {
						const isChecked = selectedSkills.includes(skill);
						const isItemEditing = editingSkillOrig === skill;
						return (
							<div
								key={skill}
								className={`flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition ${
									isChecked
										? "border-[#164027] bg-[#f0f6f1] text-[#164027]"
										: "border-[#dfe8df] bg-white text-[#55685a] hover:bg-[#f7faf7]"
								}`}
							>
								{isItemEditing ? (
									<div className="flex flex-1 items-center gap-1.5">
										<input
											type="text"
											value={editingSkillLabel}
											onChange={(e) => setEditingSkillLabel(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleSaveSkillEdit(skill);
												}
											}}
											aria-label="Sửa tên kỹ năng"
											className="h-7 flex-1 rounded-lg border border-[#164027] bg-white px-2 text-xs text-[#10221b] focus:outline-hidden"
										/>
										<button
											type="button"
											onClick={() => handleSaveSkillEdit(skill)}
											aria-label="Lưu kỹ năng"
											className="rounded-lg bg-[#164027] p-1 text-white hover:bg-[#1f5635]"
										>
											<Check size={13} />
										</button>
										<button
											type="button"
											onClick={() => setEditingSkillOrig(null)}
											aria-label="Hủy sửa kỹ năng"
											className="rounded-lg p-1 text-[#667a6d] hover:bg-[#edf2ed]"
										>
											<X size={13} />
										</button>
									</div>
								) : (
									<>
										<label className="flex flex-1 cursor-pointer select-none items-center gap-2.5 font-semibold">
											<input
												type="checkbox"
												checked={isChecked}
												onChange={() => toggleSkill(skill)}
												disabled={pending}
												className="size-4 shrink-0 rounded accent-[#164027]"
											/>
											<span className="leading-snug">{skill}</span>
										</label>
										<div className="flex shrink-0 items-center gap-0.5">
											<button
												type="button"
												disabled={pending}
												onClick={() => {
													setEditingSkillOrig(skill);
													setEditingSkillLabel(skill);
												}}
												aria-label={`Sửa kỹ năng ${skill}`}
												className="rounded-lg p-1 text-[#53674d] transition-colors hover:bg-white hover:text-[#164027]"
											>
												<Edit2 size={13} />
											</button>
											<button
												type="button"
												disabled={pending}
												onClick={() => handleDeleteSkill(skill)}
												aria-label={`Xóa kỹ năng ${skill}`}
												className="rounded-lg p-1 text-[#667a6d] transition-colors hover:bg-rose-50 hover:text-rose-700"
											>
												<Trash2 size={13} />
											</button>
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>

				<div className="flex items-center gap-2 pt-1">
					<input
						type="text"
						value={newSkillInput}
						onChange={(e) => setNewSkillInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddSkill();
							}
						}}
						disabled={pending}
						placeholder="Nhập tên kỹ năng mới để thêm vào danh sách chọn..."
						aria-label="Thêm kỹ năng mới"
						className={`${LEVEL_INPUT_CLASS} flex-1`}
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={pending || !newSkillInput.trim()}
						onClick={handleAddSkill}
						className="shrink-0 gap-1"
					>
						<Plus size={14} />
						<span>Thêm</span>
					</Button>
				</div>
				<input type="hidden" {...register("requiredSkills")} />
				{errors.requiredSkills && (
					<span className="text-xs text-red-600">{errors.requiredSkills.message}</span>
				)}
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
