import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, LEVEL_PANEL_CLASS, levelReviewError } from "../constants";
import { useMyPorterLevels } from "../hooks/usePorterLevels";
import { levelSkillsSchema as skillsSchema } from "../schema/level-review.schema";
import type { LevelEvidence } from "../types";
import { LevelReviewHistory } from "./LevelReviewHistory";

function SkillsForm({
	evidence,
	pending,
	error,
	onSave,
}: {
	evidence: LevelEvidence;
	pending: boolean;
	error: unknown;
	onSave: (data: { skills: string[]; expectedVersion: number }) => Promise<unknown>;
}) {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<z.input<typeof skillsSchema>>({
		resolver: zodResolver(skillsSchema, undefined, { raw: true }),
		defaultValues: { skills: evidence.skills.join("\n") },
	});
	return (
		<form
			className="space-y-3"
			onSubmit={handleSubmit(async (data) => {
				try {
					await onSave({ ...skillsSchema.parse(data), expectedVersion: evidence.version });
				} catch {
					/* Keep the entered skills on conflict. */
				}
			})}
		>
			<label className="block text-sm font-semibold">
				Kỹ năng tự khai (mỗi dòng một mục)
				<textarea
					rows={3}
					className={LEVEL_INPUT_CLASS}
					disabled={pending}
					{...register("skills")}
				/>
			</label>
			{errors.skills && <p role="alert">{errors.skills.message}</p>}
			{Boolean(error) && (
				<p role="alert" className="text-red-700">
					{levelReviewError(error)}
				</p>
			)}
			<Button type="submit" disabled={pending}>
				{pending ? "Đang lưu…" : "Lưu kỹ năng"}
			</Button>
		</form>
	);
}

export function PorterLevelPanel() {
	const state = useMyPorterLevels();
	return (
		<section className={`${LEVEL_PANEL_CLASS} space-y-5`}>
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-lg font-bold">Tiêu chí và lịch sử xét cấp</h2>
				<Button
					variant="outline"
					disabled={state.save.isPending}
					onClick={() =>
						void Promise.all([
							state.policies.refetch(),
							state.evidence.refetch(),
							state.history.refetch(),
						])
					}
				>
					Làm mới
				</Button>
			</div>
			<p className="text-sm text-[#627769]">
				Cấp độ được Admin duyệt riêng cho từng tuyến. Cập nhật hồ sơ hoặc tiêu chí không tự đổi cấp.
			</p>
			{state.policies.isPending && <p>Đang tải tiêu chí…</p>}
			{state.policies.isError && <p role="alert">{levelReviewError(state.policies.error)}</p>}
			{state.policies.data?.length === 0 && <p>Admin chưa cấu hình tiêu chí cấp độ.</p>}
			<div className="grid gap-3 lg:grid-cols-3">
				{state.policies.data?.map((policy) => (
					<article
						key={policy.level}
						className="space-y-2 rounded-2xl border border-[#dfe8df] p-4 text-sm"
					>
						<h3 className="font-bold">{policy.definition.name}</h3>
						<p>Tiêu chí phiên bản {policy.version}</p>
						<p>Kinh nghiệm tối thiểu: {policy.definition.minExperienceYears ?? "Chưa đặt"}</p>
						<p>Số lần dẫn tuyến: {policy.definition.minTimesLed ?? "Chưa đặt"}</p>
						<p>Kỹ năng: {policy.definition.requiredSkills.join(", ") || "Chưa đặt"}</p>
						<p>Chứng chỉ: {policy.definition.requiredCertifications.join(", ") || "Chưa đặt"}</p>
						<p className="whitespace-pre-wrap">Phạm vi: {policy.definition.responsibilities}</p>
					</article>
				))}
			</div>
			{state.evidence.isPending && <p>Đang tải kỹ năng…</p>}
			{state.evidence.isError && <p role="alert">{levelReviewError(state.evidence.error)}</p>}
			{state.evidence.data && (
				<SkillsForm
					key={state.evidence.data.version}
					evidence={state.evidence.data}
					pending={state.save.isPending}
					error={state.save.error}
					onSave={state.save.mutateAsync}
				/>
			)}
			{state.save.isSuccess && <output>Đã lưu kỹ năng. Cấp hiện tại được giữ nguyên.</output>}
			{state.history.isPending && <p>Đang tải lịch sử…</p>}
			{state.history.isError && <p role="alert">{levelReviewError(state.history.error)}</p>}
			{state.history.data && <LevelReviewHistory items={state.history.data} />}
		</section>
	);
}
