import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelReviewError } from "../constants";
import type { RequestDetail, RequestReviewInput } from "../request-types";
import { requestReviewSchema } from "../schema/level-request.schema";

const actions = [
	{ value: "approve", label: "Duyệt yêu cầu" },
	{ value: "reject", label: "Từ chối" },
	{ value: "request-info", label: "Yêu cầu bổ sung" },
] as const;
export function LevelRequestAdminActions({
	detail,
	pending,
	error,
	onReview,
}: {
	detail: RequestDetail;
	pending: boolean;
	error: unknown;
	onReview: (input: RequestReviewInput) => Promise<unknown>;
}) {
	const {
		register,
		handleSubmit,
		watch,
		formState: { errors },
	} = useForm<z.infer<typeof requestReviewSchema>>({
		resolver: zodResolver(requestReviewSchema),
		defaultValues: { reason: "" },
	});
	const action = watch("action");
	const isOpen = detail.request.status === "pending" || detail.request.status === "needs_info";
	if (!isOpen) return null;
	const canApprove = Boolean(detail.policy) && detail.dossier.verificationStatus === "approved";
	const reasonLabel =
		action === "reject"
			? "Lý do từ chối"
			: action === "request-info"
				? "Nội dung cần bổ sung"
				: "Ghi chú xét cấp";
	const submitLabel = "Xác nhận";
	return (
		<form
			className="space-y-4 pt-2"
			onSubmit={handleSubmit(async (data) => {
				try {
					await onReview({
						...data,
						expectedVersion: detail.request.version,
						...(data.action === "approve"
							? {
									expectedQualificationVersion: detail.qualification.version,
									expectedPolicyVersion: detail.policy?.version,
									expectedDossierHash: detail.dossierHash,
								}
							: {}),
					});
				} catch {
					/* Preserve the note and selected action for a manual retry. */
				}
			})}
		>
			<fieldset disabled={pending} className="space-y-2.5 border-t border-[#edf2ed] pt-4">
				<legend className="text-xs font-semibold uppercase tracking-wide text-[#53674d]">
					Xử lý yêu cầu
				</legend>
				<div className="flex flex-wrap gap-2.5">
					{actions
						.filter((item) => detail.request.status === "pending" || item.value === "reject")
						.map((item) => {
							const isSelected = action === item.value;
							const selectedStyle =
								item.value === "reject"
									? "border-rose-300 bg-rose-50 text-rose-800"
									: item.value === "request-info"
										? "border-amber-300 bg-amber-50 text-amber-900"
										: "border-[#164027] bg-[#edf5ef] text-[#164027]";
							return (
								<label
									key={item.value}
									className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors ${
										isSelected
											? selectedStyle
											: "border-[#dfe8df] bg-white text-[#4a5e51] hover:bg-[#f8faf7]"
									}`}
								>
									<input
										type="radio"
										value={item.value}
										{...register("action")}
										className="accent-[#164027]"
									/>
									<span>{item.label}</span>
								</label>
							);
						})}
				</div>
			</fieldset>
			<label className="block text-xs font-semibold text-[#10221b]">
				{reasonLabel}
				<textarea
					rows={2}
					maxLength={2000}
					className={`${LEVEL_INPUT_CLASS} mt-1.5 resize-y`}
					disabled={pending}
					placeholder={
						action === "reject"
							? "Nêu ngắn gọn lý do chưa thể chấp nhận yêu cầu"
							: "Nhập nội dung phản hồi cho người hỗ trợ"
					}
					{...register("reason")}
				/>
			</label>
			{errors.reason && (
				<p role="alert" className="text-sm text-red-700">
					{errors.reason.message}
				</p>
			)}
			{action === "approve" && !canApprove && (
				<p role="alert" className="text-sm text-amber-800">
					Cần có tiêu chí cấp đích và hồ sơ chứng chỉ đã duyệt.
				</p>
			)}
			{Boolean(error) && (
				<p role="alert" className="text-sm text-red-700">
					{levelReviewError(error)}
				</p>
			)}
			<div className="sticky -bottom-5 -mx-5 flex justify-end bg-white px-5 py-3">
				<Button
					type="submit"
					disabled={pending || !action || (action === "approve" && !canApprove)}
					className={action === "reject" ? "bg-red-700 hover:bg-red-800" : ""}
				>
					{pending ? "Đang lưu…" : submitLabel}
				</Button>
			</div>
		</form>
	);
}
