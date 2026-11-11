import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelReviewError } from "../constants";
import type { RequestDetail, RequestReviewInput } from "../request-types";
import { requestReviewSchema } from "../schema/level-request.schema";
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
		defaultValues: {
			action: detail.request.status === "needs_info" ? "reject" : "approve",
			reason: "",
		},
	});
	const action = watch("action");
	const isOpen = detail.request.status === "pending" || detail.request.status === "needs_info";
	if (!isOpen) return <p className="text-sm">Yêu cầu đã kết thúc; không thể xử lý lại.</p>;
	const canApprove = Boolean(detail.policy) && detail.dossier.verificationStatus === "approved";
	return (
		<form
			className="space-y-3 border-t border-[#dfe8df] pt-4"
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
					/* Preserve reason for manual retry after reloading. */
				}
			})}
		>
			<label className="block text-sm font-semibold">
				Thao tác Admin
				<select className={LEVEL_INPUT_CLASS} disabled={pending} {...register("action")}>
					{detail.request.status === "pending" && (
						<option value="approve">Duyệt đúng cấp đã xin</option>
					)}
					<option value="reject">Từ chối</option>
					{detail.request.status === "pending" && (
						<option value="request-info">Yêu cầu bổ sung</option>
					)}
				</select>
			</label>
			<label className="block text-sm font-semibold">
				Lý do quyết định
				<textarea
					rows={3}
					maxLength={2000}
					className={LEVEL_INPUT_CLASS}
					disabled={pending}
					{...register("reason")}
				/>
			</label>
			{errors.reason && <p role="alert">{errors.reason.message}</p>}
			{action === "approve" && !canApprove && (
				<p role="alert">
					Cần cấu hình tiêu chí cấp đích và duyệt hồ sơ chứng chỉ trước khi công nhận cấp.
				</p>
			)}
			{Boolean(error) && <p role="alert">{levelReviewError(error)}</p>}
			<Button type="submit" disabled={pending || (action === "approve" && !canApprove)}>
				{pending ? "Đang lưu…" : "Xác nhận xử lý yêu cầu"}
			</Button>
		</form>
	);
}
