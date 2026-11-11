import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
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
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<z.infer<typeof levelDecisionSchema>>({
		resolver: zodResolver(levelDecisionSchema),
		defaultValues: { reason: "", outcome: "approved" },
	});
	const { dossier, policy, qualification } = context;
	const needsCertificate = dossier.verificationStatus !== "approved";
	const openId = context.openRequestId ?? openLevelRequestId(error);
	return (
		<form
			className="space-y-4"
			onSubmit={handleSubmit(async (data) => {
				if (!policy || saved) return;
				try {
					await onDecide({
						...data,
						level: policy.level,
						expectedQualificationVersion: qualification.version,
						expectedPolicyVersion: policy.version,
						expectedDossierHash: context.dossierHash,
					});
					setSaved(true);
				} catch {
					/* Keep the reason on conflict so Admin can reload and compare again. */
				}
			})}
		>
			<div className="grid gap-2 text-sm sm:grid-cols-2">
				<p>Porter: {dossier.porterName ?? dossier.porterId}</p>
				<p>Tuyến: {qualification.routeName}</p>
				<p>
					Cấp {qualification.verifiedBy ? "đã duyệt" : "tự khai"}:{" "}
					{levelName(qualification.proficiency)}
				</p>
				<p>
					Hồ sơ chứng chỉ:{" "}
					{dossier.verificationStatus === "approved" ? "Đã được duyệt" : "Chưa được duyệt"}
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
			<label className="block text-sm font-semibold">
				Lý do xét cấp
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
			{saved && (
				<output className="block text-green-800">
					Đã lưu quyết định xét cấp. Đóng và mở lại hồ sơ nếu cần xét cấp tiếp.
				</output>
			)}
			{needsCertificate && (
				<p role="alert" className="text-amber-800">
					Cần duyệt hồ sơ chứng chỉ trong mục Duyệt hồ sơ Porter trước khi duyệt cấp.
				</p>
			)}
			<Button
				type="submit"
				disabled={pending || !policy || saved || needsCertificate || Boolean(openId)}
			>
				{pending ? "Đang lưu…" : "Lưu quyết định"}
			</Button>
		</form>
	);
}
