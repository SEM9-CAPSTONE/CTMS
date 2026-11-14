import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button, ConfirmModal } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelName, levelReviewError, openLevelRequestId } from "../constants";
import { levelDecisionSchema } from "../schema/level-review.schema";
import type { DecideLevelInput, ReviewContext } from "../types";
import { LevelComparisonTable } from "./LevelComparisonTable";
interface Props {
	context: ReviewContext;
	pending: boolean;
	error: unknown;
	onDecide: (data: DecideLevelInput) => Promise<unknown>;
}
export function LevelDecisionForm({ context, pending, error, onDecide }: Props) {
	const [saved, setSaved] = useState(false);
	const [confirmation, setConfirmation] = useState<z.infer<typeof levelDecisionSchema> | null>(
		null
	);
	const {
		register,
		watch,
		handleSubmit,
		formState: { errors },
	} = useForm<z.infer<typeof levelDecisionSchema>>({
		resolver: zodResolver(levelDecisionSchema),
		defaultValues: { reason: "", outcome: "approved" },
	});
	const { dossier, policy, qualification } = context;
	const rejected = watch("outcome") === "rejected";
	const needsCertificate = dossier.verificationStatus !== "approved";
	const openId = context.openRequestId ?? openLevelRequestId(error);
	const unchanged =
		Boolean(qualification.verifiedBy) && qualification.proficiency === policy?.level;
	return (
		<>
			<form
				className="space-y-4"
				onSubmit={handleSubmit((data) => {
					if (
						policy &&
						!saved &&
						!pending &&
						(!unchanged || data.outcome === "rejected") &&
						(!needsCertificate || data.outcome === "rejected") &&
						!openId
					)
						setConfirmation(data);
				})}
			>
				<div className="grid gap-2 text-sm sm:grid-cols-2">
					<p>Người hỗ trợ: {dossier.porterName ?? "Chưa cập nhật tên người hỗ trợ"}</p>
					<p>Tuyến: {qualification.routeName}</p>
					<p>
						Cấp {qualification.verifiedBy ? "đã duyệt" : "tự khai"}:{" "}
						{levelName(qualification.proficiency)}
					</p>
				</div>
				<LevelComparisonTable context={context} />
				{openId && (
					<p role="alert">
						Đang có yêu cầu chờ xử lý.{" "}
						<a className="underline" href={`?request=${encodeURIComponent(openId)}`}>
							Mở yêu cầu để xử lý
						</a>
					</p>
				)}
				<fieldset className="flex flex-wrap gap-3">
					<legend className="mb-2 text-sm font-semibold">Quyết định</legend>
					<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm">
						<input
							type="radio"
							value="approved"
							{...register("outcome")}
							disabled={pending || saved}
						/>
						Công nhận cấp
					</label>
					<label className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-3 text-sm">
						<input
							type="radio"
							value="rejected"
							{...register("outcome")}
							disabled={pending || saved}
						/>
						Không công nhận
					</label>
				</fieldset>
				<label className="block text-sm font-semibold">
					Ghi chú xét cấp
					<textarea
						required
						maxLength={2000}
						className={LEVEL_INPUT_CLASS}
						disabled={pending || saved}
						{...register("reason")}
					/>
				</label>
				{errors.reason && <p role="alert">{errors.reason.message}</p>}
				{Boolean(error) && (
					<p role="alert" className="text-red-700">
						{levelReviewError(error)}
					</p>
				)}
				{saved && <output className="block text-green-800">Đã lưu quyết định.</output>}
				{needsCertificate && !rejected && (
					<p role="alert" className="text-amber-800">
						Cần duyệt hồ sơ chứng chỉ trước khi công nhận cấp.
					</p>
				)}
				<div className="sticky -bottom-5 -mx-5 flex justify-end border-t border-border bg-white px-5 py-4">
					<Button
						type="submit"
						disabled={
							pending ||
							!policy ||
							saved ||
							(!rejected && needsCertificate) ||
							Boolean(openId) ||
							(!rejected && unchanged)
						}
					>
						{pending
							? "Đang lưu…"
							: rejected
								? "Lưu quyết định"
								: unchanged
									? "Đã công nhận cấp này"
									: "Công nhận cấp"}
					</Button>
				</div>
			</form>
			<ConfirmModal
				isOpen={Boolean(confirmation)}
				onClose={() => {
					if (!pending) setConfirmation(null);
				}}
				title={rejected ? "Không công nhận cấp này?" : "Xác nhận thay đổi cấp người hỗ trợ?"}
				confirmText={rejected ? "Xác nhận không công nhận" : "Xác nhận công nhận cấp"}
				isLoading={pending}
				description={
					rejected
						? `Giữ nguyên cấp ${levelName(qualification.proficiency)} của ${dossier.porterName ?? "người hỗ trợ"}.`
						: `${dossier.porterName ?? "người hỗ trợ"}: ${levelName(qualification.proficiency)} → ${policy?.definition.name ?? ""}. Tuyến ${qualification.routeName}.`
				}
				onConfirm={async () => {
					if (!confirmation || !policy || saved) return;
					try {
						await onDecide({
							...confirmation,
							level: policy.level,
							expectedQualificationVersion: qualification.version,
							expectedPolicyVersion: policy.version,
							expectedDossierHash: context.dossierHash,
						});
						setSaved(true);
					} catch {
						/* Keep the note on conflict for review. */
					} finally {
						setConfirmation(null);
					}
				}}
			/>
		</>
	);
}
