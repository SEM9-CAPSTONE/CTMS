import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	ArrowUp,
	ArrowUpRight,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Compass,
	ShieldAlert,
	ShieldCheck,
	Upload,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { usePorterCertificates } from "../../porter-certificates/hooks/usePorterCertificates";
import { usePorterProfile } from "../../porter-profile/hooks/usePorterProfile";
import { LEVEL_CODES, LEVEL_INPUT_CLASS, levelName, levelReviewError } from "../constants";
import { useMyPorterLevels } from "../hooks/usePorterLevels";
import type { CreateRequestInput, OwnQualification } from "../request-types";
import { createRequestSchema } from "../schema/level-request.schema";
import type { LevelPolicy } from "../types";

function getVietnamTodayString(): string {
	return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function getCertDisplayName(codeOrName: string): string {
	const lower = codeOrName.trim().toLowerCase();
	if (lower === "wfa") return "Sơ cấp cứu nơi hoang dã (WFA)";
	if (lower === "rescue") return "Cứu hộ dã ngoại / sông suối (Rescue)";
	if (lower === "guide_card") return "Thẻ hướng dẫn viên du lịch";
	return codeOrName;
}

export function CreateLevelRequestForm({
	qualifications,
	policies,
	pending,
	error,
	onCreate,
}: {
	qualifications: OwnQualification[];
	policies: LevelPolicy[];
	pending: boolean;
	error: unknown;
	onCreate: (input: CreateRequestInput) => Promise<unknown>;
}) {
	const {
		register,
		handleSubmit,
		watch,
		setValue,
		formState: { errors },
	} = useForm<z.infer<typeof createRequestSchema>>({
		resolver: zodResolver(createRequestSchema),
		defaultValues: { qualificationId: "", targetLevel: "proficient", reason: "" },
	});

	const [group1Expanded, setGroup1Expanded] = useState<boolean>(false);

	// Get porter's existing profile, certificates and self-declared skills
	const { certificates = [] } = usePorterCertificates();
	const { profile } = usePorterProfile();
	const { evidence } = useMyPorterLevels();

	const selectedId = watch("qualificationId");
	const selected = qualifications.find((item) => item.id === selectedId);

	// Eligible higher ranks for the selected route
	const eligible = LEVEL_CODES.filter(
		(code) => selected && LEVEL_CODES.indexOf(code) > LEVEL_CODES.indexOf(selected.proficiency)
	);

	const target = watch("targetLevel");
	const policy = policies.find((item) => item.level === target);

	// Reset manual expand state when changing route or target level
	useEffect(() => {
		if (selectedId || target) {
			setGroup1Expanded(false);
		}
	}, [selectedId, target]);

	const myExpYears = profile?.experienceYears ?? 0;
	const myTimesLed = selected?.timesLed ?? 0;
	const mySkills = evidence.data?.skills ?? [];

	// Validate criteria against target level policy
	const isExpMet =
		policy?.definition.minExperienceYears == null ||
		myExpYears >= policy.definition.minExperienceYears;

	const isTimesLedMet =
		policy?.definition.minTimesLed == null || myTimesLed >= policy.definition.minTimesLed;

	const todayStr = getVietnamTodayString();

	const certChecks = (policy?.definition.requiredCertifications ?? []).map((reqCert) => {
		const reqNorm = reqCert.trim().toLowerCase();
		const matched = certificates.find((c) => {
			const typeNorm = (c.type ?? c.certificateType ?? "").toLowerCase();
			const nameNorm = c.name.trim().toLowerCase();
			return typeNorm === reqNorm || nameNorm.includes(reqNorm) || reqNorm.includes(nameNorm);
		});

		let status: "verified" | "expired" | "rejected" | "pending" | "missing" = "missing";
		let rejectionReason: string | null = null;
		let expiryDateFormatted: string | null = null;

		if (matched) {
			const expRaw = matched.expiryDate ? matched.expiryDate.split("T")[0] : null;
			if (expRaw) {
				const parts = expRaw.split("-");
				expiryDateFormatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : expRaw;
			}
			if (matched.status === "verified") {
				if (expRaw && expRaw < todayStr) {
					status = "expired";
				} else {
					status = "verified";
				}
			} else if (matched.status === "rejected") {
				status = "rejected";
				rejectionReason = matched.rejectionReason ?? null;
			} else if (matched.status === "pending") {
				status = "pending";
			}
		}

		const requiredLabel = getCertDisplayName(reqCert);
		const userCertName = matched?.name ?? null;

		return {
			reqCode: reqCert,
			requiredLabel,
			userCertName,
			displayName: requiredLabel,
			hasCert: Boolean(matched),
			status,
			rejectionReason,
			expiryDateFormatted,
			met: status === "verified",
		};
	});

	const areCertsMet = certChecks.every((c) => c.met);

	const skillChecks = (policy?.definition.requiredSkills ?? []).map((reqSkill) => {
		const reqNorm = reqSkill.trim().toLowerCase();
		const met = mySkills.some((s) => s.trim().toLowerCase().includes(reqNorm));
		return { skillName: reqSkill, met };
	});
	const areSkillsMet = skillChecks.every((s) => s.met);

	// Group 1 completeness
	const allGroup1Met = isExpMet && areCertsMet && areSkillsMet;
	const isGroup1Open = !allGroup1Met || group1Expanded;

	// Overall completeness
	const allCriteriaMet = allGroup1Met && isTimesLedMet;

	// Certificate alert status nuance
	const hasRejectedCert = certChecks.some((c) => c.status === "rejected");
	const hasExpiredCert = certChecks.some((c) => c.status === "expired");
	const hasMissingCert = certChecks.some((c) => c.status === "missing");
	const hasPendingCert = certChecks.some((c) => c.status === "pending");
	const onlyPendingCert = hasPendingCert && !hasRejectedCert && !hasExpiredCert && !hasMissingCert;

	const scrollToCertificates = () => {
		document.getElementById("porter-certificates-section")?.scrollIntoView({ behavior: "smooth" });
	};

	const handleSelectQualification = (id: string) => {
		setValue("qualificationId", id, { shouldValidate: true });
		const qual = qualifications.find((item) => item.id === id);
		if (qual) {
			const nextLevel = LEVEL_CODES[LEVEL_CODES.indexOf(qual.proficiency) + 1];
			if (nextLevel) {
				setValue("targetLevel", nextLevel, { shouldValidate: true });
			}
		}
	};

	const watchedFiles = watch("files");
	const selectedFileCount = watchedFiles?.length ?? 0;

	return (
		<form
			className="space-y-4"
			onSubmit={handleSubmit(async (data) => {
				if (
					!selected ||
					selected.openRequestId ||
					!eligible.includes(data.targetLevel) ||
					(policy && !allCriteriaMet)
				)
					return;
				try {
					await onCreate({
						routeId: selected.routeId,
						targetLevel: data.targetLevel,
						reason: data.reason,
						expectedQualificationVersion: selected.version,
						files: Array.from(data.files ?? []),
					});
				} catch {
					/* Keep entered request after API validation/conflict. */
				}
			})}
		>
			<p className="text-xs text-[#627769]">
				Đề nghị nâng cấp cấp độ chuyên môn người hỗ trợ theo từng tuyến. Bạn có thể chọn tuyến đã
				từng hướng dẫn làm minh chứng kinh nghiệm thực địa để Quản trị viên đối chiếu và xét duyệt.
			</p>

			{/* Step 1: Chọn tuyến làm minh chứng */}
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<span className="block text-xs font-bold text-[#10221b]">
						Tuyến đã từng hướng dẫn (chọn làm minh chứng):
					</span>
					<label className="text-xs text-[#627769] flex items-center gap-1.5">
						<span className="sr-only">Tuyến đã khai báo</span>
						<select
							aria-label="Tuyến đã khai báo"
							className="rounded-lg border border-[#dfe8df] bg-white px-2 py-1 text-xs text-[#10221b] outline-none"
							disabled={pending}
							value={watch("qualificationId")}
							onChange={(event) => handleSelectQualification(event.target.value)}
						>
							<option value="">-- Chọn tuyến minh chứng --</option>
							{qualifications.map((item) => (
								<option
									key={item.id}
									value={item.id}
									disabled={Boolean(item.openRequestId) || item.proficiency === "expert"}
								>
									{item.routeName} · Đã dẫn {item.timesLed} chuyến (Cấp hiện tại:{" "}
									{levelName(item.proficiency, policies)})
									{item.openRequestId ? " · Đang có yêu cầu xử lý" : ""}
								</option>
							))}
						</select>
					</label>
				</div>

				{/* Danh sách các tuyến dạng thẻ chọn trực quan */}
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
					{qualifications.map((item) => {
						const isSelected = selectedId === item.id;
						const isExpert = item.proficiency === "expert";
						const hasPending = Boolean(item.openRequestId);
						const isDisabled = isExpert || hasPending;

						return (
							<button
								key={item.id}
								type="button"
								disabled={isDisabled || pending}
								onClick={() => handleSelectQualification(item.id)}
								className={`flex flex-col justify-between rounded-xl border p-3 text-left transition select-none ${
									isDisabled
										? "opacity-50 cursor-not-allowed bg-[#f8faf8] border-[#e2e8e2]"
										: isSelected
											? "border-[#164027] bg-[#edf5ef] ring-1 ring-[#164027]"
											: "border-[#dfe8df] bg-white hover:border-[#b4cbb4] hover:bg-[#fafcfa]"
								}`}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex items-center gap-2 min-w-0">
										<input
											type="radio"
											name="qualification_radio"
											checked={isSelected}
											disabled={isDisabled || pending}
											readOnly
											className="size-4 accent-[#164027] shrink-0"
										/>
										<span className="font-extrabold text-xs text-[#10221b] truncate">
											{item.routeName}
										</span>
									</div>
									<span
										className={`rounded-full px-2 py-0.5 text-[10px] font-bold border shrink-0 ${
											item.proficiency === "expert"
												? "bg-amber-50 text-amber-900 border-amber-200"
												: item.proficiency === "proficient"
													? "bg-emerald-50 text-emerald-900 border-emerald-200"
													: "bg-blue-50 text-blue-900 border-blue-200"
										}`}
									>
										{levelName(item.proficiency, policies)}
									</span>
								</div>

								<div className="mt-2 flex items-center justify-between text-[11px] text-[#627769]">
									<span>
										Đã dẫn: <strong>{item.timesLed}</strong> chuyến
									</span>
									{hasPending ? (
										<span className="font-bold text-amber-700">Đang chờ duyệt</span>
									) : isExpert ? (
										<span className="font-bold text-[#627769]">Cấp cao nhất</span>
									) : (
										<span className="text-emerald-700 font-semibold">Minh chứng dẫn tuyến</span>
									)}
								</div>
							</button>
						);
					})}
				</div>
			</div>
			{errors.qualificationId && (
				<p role="alert" className="text-xs text-red-600">
					{errors.qualificationId.message}
				</p>
			)}

			{/* Thông báo nếu chưa chọn tuyến */}
			{!selected && (
				<div className="rounded-xl border border-dashed border-[#dfe8df] bg-[#fafcfa] p-4 text-center text-xs text-[#627769]">
					<Compass className="size-5 mx-auto mb-1.5 text-[#889988]" />
					<p className="font-bold text-[#10221b]">Chưa chọn tuyến minh chứng</p>
					<p className="mt-0.5">
						Vui lòng chọn 1 tuyến bạn đã từng hướng dẫn ở trên để đối chiếu tiêu chí và đề nghị nâng
						cấp.
					</p>
				</div>
			)}

			{/* Khi đã chọn tuyến */}
			{selected && (
				<>
					<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f4f7f2] px-3.5 py-2.5 text-xs text-[#164027] border border-[#dfe8df]">
						<span>
							<strong>Tuyến minh chứng đã chọn:</strong> {selected.routeName} (Cấp hiện tại:{" "}
							{levelName(selected.proficiency, policies)})
						</span>
						<span className="font-semibold text-[#627769]">
							Đã hoàn thành {selected.timesLed} chuyến thực tế ·{" "}
							{selected.verifiedBy ? "Đã được xác minh" : "Tự khai"}
						</span>
					</div>

					{/* Step 2: Chọn cấp muốn nâng (chỉ hiện cấp cao hơn cấp hiện tại) */}
					<label className="block text-xs font-bold text-[#10221b] space-y-1">
						<span>Cấp độ đề nghị nâng</span>
						<select
							aria-label="Cấp muốn nâng"
							className={LEVEL_INPUT_CLASS}
							disabled={pending || eligible.length === 0}
							{...register("targetLevel")}
						>
							{eligible.map((code) => (
								<option key={code} value={code}>
									{levelName(code, policies)}
								</option>
							))}
						</select>
					</label>

					{/* Step 3: Đối chiếu tiêu chí tự động - Tách rõ 2 Nhóm */}
					{policy ? (
						<div
							id="unmet-criteria-target"
							className="space-y-4 rounded-2xl border border-[#dfe8df] bg-[#fafcfa] p-4 text-xs shadow-2xs scroll-mt-4"
						>
							<div className="flex items-center justify-between border-b border-[#dfe8df] pb-2">
								<div className="flex items-center gap-1.5 font-extrabold text-[#10221b] text-sm">
									<ShieldCheck className="size-4 text-[#164027]" />
									<span>Đối chiếu tiêu chí cấp: {policy.definition.name}</span>
								</div>
								<span className="text-[11px] text-[#627769]">Cấu hình: v{policy.version}</span>
							</div>

							{/* NHÓM 1: TIÊU CHÍ CHUNG TÀI KHOẢN (Cho phép thu gọn khi đã đạt toàn bộ) */}
							{allGroup1Met && !isGroup1Open ? (
								<div
									onClick={() => setGroup1Expanded(true)}
									className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 cursor-pointer hover:bg-emerald-100/60 transition select-none"
								>
									<div className="flex items-center gap-2.5">
										<CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
										<div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-[10px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
													Nhóm 1
												</span>
												<span className="font-extrabold text-xs text-emerald-950">
													Tiêu chí chung tài khoản · Đã đạt đủ điều kiện
												</span>
											</div>
											<p className="text-[11px] text-emerald-800/80 mt-0.5">
												Đã có {myExpYears} năm kinh nghiệm, đầy đủ chứng chỉ & kỹ năng yêu cầu.
											</p>
										</div>
									</div>
									<button
										type="button"
										className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline shrink-0 ml-2"
									>
										<span>Xem chi tiết</span>
										<ChevronDown size={14} />
									</button>
								</div>
							) : (
								<div className="space-y-3 rounded-xl border border-[#dfe8df] bg-white p-3.5 transition">
									<div className="flex items-center justify-between border-b border-[#dfe8df]/70 pb-2">
										<div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-[10px] text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md uppercase tracking-wider">
													Nhóm 1
												</span>
												<span className="font-extrabold text-xs text-[#10221b]">
													Tiêu chí chung tài khoản
												</span>
											</div>
											<p className="text-[11px] text-[#627769] mt-0.5">
												Đã xác minh một lần, dùng chung cho mọi tuyến.
											</p>
										</div>
										{allGroup1Met && (
											<button
												type="button"
												onClick={() => setGroup1Expanded(false)}
												className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950"
											>
												<span>Thu gọn</span>
												<ChevronUp size={14} />
											</button>
										)}
									</div>

									{/* 1.1 Kinh nghiệm làm người hỗ trợ */}
									<div
										className={`p-3 rounded-xl border transition ${
											isExpMet
												? "bg-emerald-50/70 border-emerald-200"
												: "bg-amber-50/70 border-amber-200"
										}`}
									>
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5 font-bold">
												{isExpMet ? (
													<CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
												) : (
													<XCircle className="size-4 text-amber-600 shrink-0" />
												)}
												<span className={isExpMet ? "text-emerald-900" : "text-amber-900"}>
													Kinh nghiệm làm người hỗ trợ
												</span>
											</div>
											<span className="text-[11px] font-bold">
												{isExpMet ? "✅ Đạt yêu cầu" : "⚠️ Chưa đạt"}
											</span>
										</div>
										<p className="mt-1 text-[#55685a]">
											Yêu cầu:{" "}
											{policy.definition.minExperienceYears != null
												? `${policy.definition.minExperienceYears} năm`
												: "Không bắt buộc"}{" "}
											· Hiện có: <strong>{myExpYears} năm</strong>
										</p>
										{!isExpMet && (
											<p className="mt-1 text-amber-800 font-semibold text-[11px]">
												Cần tích lũy thêm {(policy.definition.minExperienceYears ?? 0) - myExpYears}{" "}
												năm kinh nghiệm.
											</p>
										)}
									</div>

									{/* 1.2 Chứng chỉ chuyên môn bắt buộc */}
									{policy.definition.requiredCertifications.length > 0 && (
										<div className="space-y-2 pt-1">
											<div className="flex items-center justify-between">
												<span className="font-bold text-[#10221b] block">
													Chứng chỉ chuyên môn bắt buộc:
												</span>
												<button
													type="button"
													onClick={scrollToCertificates}
													className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5"
												>
													<span>Quản lý chứng chỉ</span>
													<ArrowUpRight size={12} />
												</button>
											</div>
											<div className="space-y-1.5">
												{certChecks.map(
													({
														reqCode,
														requiredLabel,
														userCertName,
														status,
														rejectionReason,
														expiryDateFormatted,
														met,
													}) => (
														<div
															key={reqCode}
															className={`p-2.5 rounded-xl border text-xs ${
																met
																	? "bg-emerald-50/60 border-emerald-200 text-emerald-900"
																	: status === "rejected"
																		? "bg-rose-50/70 border-rose-200 text-rose-900"
																		: status === "expired"
																			? "bg-amber-50/70 border-amber-200 text-amber-900"
																			: status === "pending"
																				? "bg-blue-50/60 border-blue-200 text-blue-900"
																				: "bg-rose-50/60 border-rose-200 text-rose-900"
															}`}
														>
															<div className="flex items-center justify-between gap-2">
																<div className="flex items-center gap-2 min-w-0">
																	{met ? (
																		<CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
																	) : status === "pending" ? (
																		<ShieldAlert className="size-4 shrink-0 text-blue-600" />
																	) : (
																		<XCircle className="size-4 shrink-0 text-rose-600" />
																	)}
																	<span className="font-semibold truncate">{requiredLabel}</span>
																</div>
																<span className="text-[11px] font-bold shrink-0">
																	{status === "verified"
																		? `✅ Đã xác minh${expiryDateFormatted ? ` (Hạn: ${expiryDateFormatted})` : ""}`
																		: status === "expired"
																			? `❌ Hết hạn (${expiryDateFormatted ?? ""})`
																			: status === "rejected"
																				? "❌ Bị từ chối"
																				: status === "pending"
																					? "⏳ Đang chờ xác minh"
																					: "❌ Chưa có chứng chỉ"}
																</span>
															</div>
															{userCertName && (
																<p
																	className={`mt-0.5 text-[11px] pl-6 truncate ${
																		status === "verified"
																			? "text-emerald-800/80"
																			: status === "rejected"
																				? "text-rose-800/80"
																				: "text-[#627769]"
																	}`}
																>
																	{status === "rejected" ? "Chứng chỉ đã nộp: " : "Hồ sơ đã nộp: "}
																	<span className="font-medium text-[#10221b]">{userCertName}</span>
																</p>
															)}
															{status === "rejected" && rejectionReason && (
																<p className="mt-1 text-[11px] text-rose-700 pl-6">
																	<span className="font-bold">Lý do từ chối:</span>{" "}
																	{rejectionReason}
																</p>
															)}
														</div>
													)
												)}
											</div>

											{/* Thông báo ngữ cảnh tinh tế theo trạng thái chứng chỉ */}
											{!areCertsMet &&
												(onlyPendingCert ? (
													<div className="flex items-start gap-1.5 rounded-lg bg-blue-50/90 p-2.5 text-[11px] text-blue-900 border border-blue-200">
														<ShieldAlert size={14} className="shrink-0 mt-0.5 text-blue-600" />
														<span>
															Chứng chỉ chuyên môn đang chờ Quản trị viên xác minh, bạn không cần
															thao tác thêm.
														</span>
													</div>
												) : hasRejectedCert ? (
													<div className="flex items-start gap-1.5 rounded-lg bg-rose-50/90 p-2.5 text-[11px] text-rose-900 border border-rose-200">
														<AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
														<div>
															<span>
																Bạn có chứng chỉ bị từ chối xét duyệt. Vui lòng kiểm tra lý do và
																chụp lại rõ nét tại mục{" "}
															</span>
															<button
																type="button"
																onClick={scrollToCertificates}
																className="font-bold underline text-rose-950 hover:text-black inline-flex items-center gap-0.5"
															>
																Chứng chỉ & Bằng cấp chuyên môn
																<ArrowUpRight size={11} />
															</button>
															<span>.</span>
														</div>
													</div>
												) : (
													<div className="flex items-start gap-1.5 rounded-lg bg-amber-50/90 p-2.5 text-[11px] text-amber-900 border border-amber-200">
														<AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
														<div>
															<span>
																Bạn có chứng chỉ còn thiếu hoặc đã hết hạn. Vui lòng tải lên hoặc
																cập nhật tại mục{" "}
															</span>
															<button
																type="button"
																onClick={scrollToCertificates}
																className="font-bold underline text-amber-950 hover:text-black inline-flex items-center gap-0.5"
															>
																Chứng chỉ & Bằng cấp chuyên môn
																<ArrowUpRight size={11} />
															</button>
															<span> để Quản trị viên duyệt trước khi yêu cầu nâng cấp.</span>
														</div>
													</div>
												))}
										</div>
									)}

									{/* 1.3 Kỹ năng bắt buộc */}
									{policy.definition.requiredSkills.length > 0 && (
										<div className="space-y-2 pt-1">
											<span className="font-bold text-[#10221b] block">Kỹ năng bắt buộc:</span>
											<div className="flex flex-wrap gap-1.5">
												{skillChecks.map(({ skillName, met }) => (
													<span
														key={skillName}
														className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
															met
																? "bg-emerald-50 border-emerald-200 text-emerald-900"
																: "bg-amber-50 border-amber-200 text-amber-900"
														}`}
													>
														{met ? (
															<CheckCircle2 size={12} className="text-emerald-600" />
														) : (
															<XCircle size={12} className="text-amber-600" />
														)}
														<span>{skillName}</span>
													</span>
												))}
											</div>
											{!areSkillsMet && (
												<p className="text-[11px] text-amber-700 font-medium">
													💡 Bạn có thể cập nhật các kỹ năng đã tích lũy trong hồ sơ cá nhân.
												</p>
											)}
										</div>
									)}
								</div>
							)}

							{/* NHÓM 2: MINH CHỨNG THỰC ĐỊA THEO TUYẾN */}
							<div className="space-y-3 rounded-xl border border-[#dfe8df] bg-white p-3.5">
								<div className="border-b border-[#dfe8df]/70 pb-2">
									<div className="flex items-center gap-2">
										<span className="font-bold text-[10px] text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded-md uppercase tracking-wider">
											Nhóm 2
										</span>
										<span className="font-extrabold text-xs text-[#10221b]">
											Minh chứng thực địa theo tuyến
										</span>
									</div>
									<p className="text-[11px] text-[#627769] mt-0.5">
										Kinh nghiệm và số chuyến thực tế đã hoàn thành trên tuyến minh chứng đã chọn.
									</p>
								</div>

								{/* Số lần dẫn tuyến */}
								<div
									className={`p-3 rounded-xl border transition ${
										isTimesLedMet
											? "bg-emerald-50/70 border-emerald-200"
											: "bg-amber-50/70 border-amber-200"
									}`}
								>
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-1.5 font-bold">
											{isTimesLedMet ? (
												<CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
											) : (
												<XCircle className="size-4 text-amber-600 shrink-0" />
											)}
											<span className={isTimesLedMet ? "text-emerald-900" : "text-amber-900"}>
												Số chuyến đã dẫn trên tuyến {selected.routeName}
											</span>
										</div>
										<span className="text-[11px] font-bold">
											{isTimesLedMet ? "✅ Đạt yêu cầu" : "⚠️ Chưa đạt"}
										</span>
									</div>
									<p className="mt-1 text-[#55685a]">
										Yêu cầu:{" "}
										{policy.definition.minTimesLed != null
											? `${policy.definition.minTimesLed} chuyến`
											: "Không bắt buộc"}{" "}
										· Đã dẫn trên tuyến này: <strong>{myTimesLed} chuyến</strong>
									</p>
									{!isTimesLedMet && (
										<p className="mt-1 text-amber-800 font-semibold text-[11px]">
											Cần hoàn thành thêm {(policy.definition.minTimesLed ?? 0) - myTimesLed} chuyến
											trên tuyến này.
										</p>
									)}
								</div>
							</div>

							{/* Banner đánh giá tổng thể */}
							{!allCriteriaMet ? (
								<div className="flex items-start gap-2.5 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
									<AlertCircle className="size-4 shrink-0 text-rose-600 mt-0.5" />
									<div>
										<p className="font-bold">
											Chưa đủ điều kiện nâng cấp lên {policy.definition.name}.
										</p>
										<p className="mt-0.5 text-rose-800">
											Vui lòng hoàn thiện các tiêu chí còn thiếu được đánh dấu ở trên trước khi gửi
											yêu cầu xét duyệt tới Quản trị viên.
										</p>
									</div>
								</div>
							) : (
								<div className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 font-bold">
									<CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
									<span>Bạn đã đáp ứng đầy đủ điều kiện nâng cấp lên cấp độ này!</span>
								</div>
							)}
						</div>
					) : (
						<p className="text-xs text-[#627769]">
							Chưa có tiêu chí cụ thể cho cấp này. Bạn có thể gửi đề xuất kèm minh chứng kinh nghiệm
							để Quản trị viên xem xét.
						</p>
					)}
				</>
			)}

			{/* Step 4: Lý do & Minh chứng */}
			<label className="block text-xs font-bold text-[#10221b] space-y-1">
				<span>Lý do yêu cầu</span>
				<textarea
					className={LEVEL_INPUT_CLASS}
					rows={3}
					maxLength={2000}
					disabled={pending}
					placeholder="Trình bày lý do, kinh nghiệm thực tế và các thành tích dẫn đoàn trên tuyến..."
					{...register("reason")}
				/>
			</label>
			{errors.reason && (
				<p role="alert" className="text-xs text-red-600">
					{errors.reason.message}
				</p>
			)}

			{/* Tùy chỉnh tải tệp tiếng Việt (không dùng Choose Files / No file chosen mặc định) */}
			<div className="space-y-1.5">
				<label
					htmlFor="level-evidence-file-input"
					className="block text-xs font-bold text-[#10221b]"
				>
					Minh chứng (tùy chọn, tối đa 5 tệp, 5 MB/tệp)
				</label>
				<div className="flex flex-wrap items-center gap-3">
					<label
						htmlFor="level-evidence-file-input"
						className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] bg-white px-3.5 py-2 text-xs font-bold text-[#164027] hover:bg-[#f4f7f2] shadow-2xs transition"
					>
						<Upload className="size-3.5 text-[#164027]" />
						<span>Chọn tệp từ thiết bị</span>
					</label>
					<span className="text-[11px] text-[#627769]">
						{selectedFileCount > 0 ? `Đã chọn ${selectedFileCount} tệp` : "Chưa chọn tệp nào"}
					</span>
					<input
						id="level-evidence-file-input"
						className="sr-only"
						type="file"
						multiple
						accept="application/pdf,image/png,image/jpeg"
						disabled={pending}
						{...register("files")}
					/>
				</div>
			</div>
			{errors.files && (
				<p role="alert" className="text-xs text-red-600">
					{errors.files.message}
				</p>
			)}
			{Boolean(error) && (
				<p role="alert" className="text-xs text-red-600 font-bold">
					{levelReviewError(error)}
				</p>
			)}

			<div className="space-y-1.5 pt-1">
				<Button
					type="submit"
					aria-disabled={
						pending ||
						!selected ||
						eligible.length === 0 ||
						Boolean(selected.openRequestId) ||
						(policy ? !allCriteriaMet : false)
					}
					aria-describedby={selected && !allCriteriaMet ? "submit-locked-hint" : undefined}
					title={
						!selected
							? "Vui lòng chọn tuyến minh chứng ở trên"
							: !allCriteriaMet
								? "Hồ sơ chưa đáp ứng đủ các tiêu chí được đánh dấu ở trên"
								: undefined
					}
					disabled={
						pending ||
						!selected ||
						eligible.length === 0 ||
						Boolean(selected.openRequestId) ||
						(policy ? !allCriteriaMet : false)
					}
					className={
						!selected || (policy ? !allCriteriaMet : false)
							? "!bg-slate-200 !text-slate-700 !opacity-100 font-bold border border-slate-300 cursor-not-allowed hover:!bg-slate-200"
							: ""
					}
				>
					{pending ? "Đang gửi…" : "Gửi yêu cầu nâng cấp"}
				</Button>
				{selected && !allCriteriaMet && (
					<div id="submit-locked-hint" className="flex flex-wrap items-center gap-2 pt-0.5">
						<p className="text-[11px] text-slate-600 font-medium">
							Nút gửi tạm khóa do chưa đạt đủ tiêu chí.
						</p>
						<button
							type="button"
							onClick={() => {
								const targetEl = document.getElementById("unmet-criteria-target");
								if (targetEl) {
									targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
								}
							}}
							className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 underline inline-flex items-center gap-0.5"
						>
							<span>Cuộn tới tiêu chí chưa đạt</span>
							<ArrowUp size={12} />
						</button>
					</div>
				)}
			</div>
		</form>
	);
}
