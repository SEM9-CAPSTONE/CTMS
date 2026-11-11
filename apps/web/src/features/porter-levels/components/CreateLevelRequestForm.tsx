import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { LEVEL_CODES, LEVEL_INPUT_CLASS, levelName, levelReviewError } from "../constants";
import type { CreateRequestInput, OwnQualification } from "../request-types";
import { createRequestSchema } from "../schema/level-request.schema";
import type { LevelPolicy } from "../types";

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
	const selected = qualifications.find((item) => item.id === watch("qualificationId"));
	const target = watch("targetLevel");
	const policy = policies.find((item) => item.level === target);
	const eligible = LEVEL_CODES.filter(
		(code) => selected && LEVEL_CODES.indexOf(code) > LEVEL_CODES.indexOf(selected.proficiency)
	);
	return (
		<form
			className="space-y-4"
			onSubmit={handleSubmit(async (data) => {
				if (!selected || selected.openRequestId || !eligible.includes(data.targetLevel)) return;
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
			<p className="text-sm text-[#627769]">
				Chỉ áp dụng cho tuyến đã khai báo. Cấp hiện tại chưa xác minh là cấp tự khai; Admin quyết
				định công nhận khi duyệt.
			</p>
			<label className="block text-sm font-semibold">
				Tuyến đã khai báo
				<select
					className={LEVEL_INPUT_CLASS}
					disabled={pending}
					{...register("qualificationId", {
						onChange: (event) => {
							const qualification = qualifications.find((item) => item.id === event.target.value);
							const next =
								LEVEL_CODES[LEVEL_CODES.indexOf(qualification?.proficiency ?? "expert") + 1];
							if (next) setValue("targetLevel", next);
						},
					})}
				>
					<option value="">Chọn tuyến</option>
					{qualifications.map((item) => (
						<option
							key={item.id}
							value={item.id}
							disabled={Boolean(item.openRequestId) || item.proficiency === "expert"}
						>
							{item.routeName} · {levelName(item.proficiency, policies)}
							{item.openRequestId ? " · Đang xử lý" : ""}
						</option>
					))}
				</select>
			</label>
			{errors.qualificationId && <p role="alert">{errors.qualificationId.message}</p>}
			{selected && (
				<p className="text-sm">
					Cấp hiện tại: {levelName(selected.proficiency, policies)} ·{" "}
					{selected.verifiedBy ? "Đã xác minh" : "Tự khai, chưa xác minh"}
				</p>
			)}
			<label className="block text-sm font-semibold">
				Cấp muốn nâng
				<select
					className={LEVEL_INPUT_CLASS}
					disabled={pending || !selected}
					{...register("targetLevel")}
				>
					{eligible.map((code) => (
						<option key={code} value={code}>
							{levelName(code, policies)}
						</option>
					))}
				</select>
			</label>
			{policy ? (
				<div className="space-y-1 rounded-xl border border-[#dfe8df] p-3 text-sm">
					<h3 className="font-bold">
						Tiêu chí {policy.definition.name} · v{policy.version}
					</h3>
					<p>
						Kinh nghiệm: {policy.definition.minExperienceYears ?? "Chưa đặt"}; số lần dẫn tuyến:{" "}
						{policy.definition.minTimesLed ?? "Chưa đặt"}
					</p>
					<p>Kỹ năng: {policy.definition.requiredSkills.join(", ") || "Chưa đặt"}</p>
					<p>Chứng chỉ: {policy.definition.requiredCertifications.join(", ") || "Chưa đặt"}</p>
					<p>Phạm vi: {policy.definition.responsibilities}</p>
				</div>
			) : (
				<p className="text-sm">
					Admin chưa cấu hình tiêu chí cấp đích. Yêu cầu vẫn gửi được; Admin cần cấu hình trước khi
					duyệt.
				</p>
			)}
			<label className="block text-sm font-semibold">
				Lý do yêu cầu
				<textarea
					className={LEVEL_INPUT_CLASS}
					rows={3}
					maxLength={2000}
					disabled={pending}
					{...register("reason")}
				/>
			</label>
			{errors.reason && <p role="alert">{errors.reason.message}</p>}
			<label className="block text-sm font-semibold">
				Minh chứng (tùy chọn, tối đa 5 tệp, 5 MB/tệp)
				<input
					className={LEVEL_INPUT_CLASS}
					type="file"
					multiple
					accept="application/pdf,image/png,image/jpeg"
					disabled={pending}
					{...register("files")}
				/>
			</label>
			{errors.files && <p role="alert">{errors.files.message}</p>}
			{Boolean(error) && <p role="alert">{levelReviewError(error)}</p>}
			<Button
				type="submit"
				disabled={pending || !selected || eligible.length === 0 || Boolean(selected.openRequestId)}
			>
				{pending ? "Đang gửi…" : "Gửi yêu cầu nâng cấp"}
			</Button>
		</form>
	);
}
