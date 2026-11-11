import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "../../../shared/components";
import { LEVEL_INPUT_CLASS, levelReviewError } from "../constants";
import type { RequestDetail } from "../request-types";
import { resubmitRequestSchema } from "../schema/level-request.schema";
export function LevelRequestPorterActions({
	detail,
	pending,
	error,
	onCancel,
	onResubmit,
	onAdd,
}: {
	detail: RequestDetail;
	pending: boolean;
	error: unknown;
	onCancel: () => void;
	onResubmit: (reason: string) => Promise<unknown>;
	onAdd: (files: File[]) => Promise<unknown>;
}) {
	const {
		register,
		handleSubmit,
		getValues,
		resetField,
		trigger,
		setError,
		formState: { errors },
	} = useForm<z.infer<typeof resubmitRequestSchema>>({
		resolver: zodResolver(resubmitRequestSchema),
		defaultValues: { reason: detail.request.reason },
	});
	if (detail.request.status !== "pending" && detail.request.status !== "needs_info") return null;
	return (
		<div className="space-y-4 border-t border-[#dfe8df] pt-4">
			{detail.request.status === "pending" && (
				<p className="text-sm">
					Yêu cầu đang chờ Admin xử lý. Bạn có thể hủy; nội dung chỉ được sửa khi Admin yêu cầu bổ
					sung.
				</p>
			)}
			{detail.request.status === "needs_info" && (
				<form
					className="space-y-3"
					onSubmit={handleSubmit(async (data) => {
						if (data.files?.length) {
							setError("files", { message: "Vui lòng tải lên các tệp đã chọn trước khi gửi lại." });
							return;
						}
						try {
							await onResubmit(data.reason);
						} catch {
							/* Keep changes on conflict. */
						}
					})}
				>
					<label className="block text-sm font-semibold">
						Lý do yêu cầu sau bổ sung
						<textarea
							className={LEVEL_INPUT_CLASS}
							rows={3}
							disabled={pending}
							{...register("reason")}
						/>
					</label>
					{errors.reason && <p role="alert">{errors.reason.message}</p>}
					<label className="block text-sm font-semibold">
						Thêm minh chứng (PDF, PNG, JPEG; tối đa 5 MB/tệp)
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
					<Button
						variant="outline"
						disabled={pending}
						onClick={async () => {
							if (!(await trigger("files"))) return;
							const selectedFiles = getValues("files");
							if (!selectedFiles?.length) {
								setError("files", { message: "Vui lòng chọn tệp minh chứng." });
								return;
							}
							if (selectedFiles.length) {
								try {
									await onAdd(Array.from(selectedFiles));
									resetField("files");
								} catch {
									/* Mutation error shown below. */
								}
							}
						}}
					>
						Tải lên minh chứng bổ sung
					</Button>
					<p className="text-sm text-[#627769]">
						Tải lên tệp trước khi gửi lại. Cần thay đổi lý do, hồ sơ hoặc minh chứng so với lần gửi
						trước.
					</p>
					<Button type="submit" disabled={pending}>
						Gửi lại để Admin duyệt
					</Button>
				</form>
			)}
			{Boolean(error) && <p role="alert">{levelReviewError(error)}</p>}
			<Button variant="outline" disabled={pending} onClick={onCancel}>
				Hủy yêu cầu
			</Button>
		</div>
	);
}
