import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button, ConfirmModal } from "../../../shared/components";
import { SelectField } from "../../../shared/components/SelectField";
import { SEVERITY_OPTIONS } from "../constants";
import {
	type ApproveProposalFormData,
	type ApproveProposalFormInput,
	approveProposalSchema,
	rejectProposalSchema,
} from "../schema/proposal.schema";
import type { ApproveProposalPayload, DangerZoneProposal } from "../types";

interface Props {
	proposal: DangerZoneProposal;
	submitting: boolean;
	onApprove: (payload: ApproveProposalPayload) => Promise<boolean>;
	onReject: (reason: string) => Promise<boolean>;
}

const fieldClass =
	"w-full rounded-xl border border-[#dfe8df] bg-white p-3 text-sm text-[#10221b] transition-colors duration-150 focus:border-[#164027] focus:outline-none disabled:opacity-60";
const labelClass = "text-xs font-medium tracking-wide text-[#667a6d]";

function FieldError({ message }: { message?: string }) {
	if (!message) return null;
	return (
		<p role="alert" className="text-xs text-rose-700">
			{message}
		</p>
	);
}

/**
 * The Admin writes what everyone will see on the map. A field report may name members, so the
 * public description is edited here before approval rather than copied blindly.
 */
export function ProposalDecisionForm({ proposal, submitting, onApprove, onReject }: Props) {
	const isPoint = proposal.geometry.type === "Point";
	const [pending, setPending] = useState<"approve" | "reject" | null>(null);
	const [rejectReason, setRejectReason] = useState("");
	const [rejectError, setRejectError] = useState<string>();
	const {
		register,
		control,
		handleSubmit,
		formState: { errors },
	} = useForm<ApproveProposalFormInput, unknown, ApproveProposalFormData>({
		resolver: zodResolver(approveProposalSchema),
		defaultValues: {
			severity: proposal.severity,
			// Reporter text is a starting point the Admin edits; automatic incident text is not copied.
			description: proposal.source === "INCIDENT" ? "" : proposal.description,
			radiusMeters: proposal.radiusMeters ?? undefined,
		},
	});

	const closeConfirm = () => {
		setRejectError(undefined);
		setPending(null);
	};

	const confirm = async () => {
		if (pending === "reject") {
			// The rejection reason is shown to the reporter, so it is asked for at the decision itself.
			const parsed = rejectProposalSchema.safeParse({ reason: rejectReason });
			if (!parsed.success) {
				setRejectError(parsed.error.issues[0]?.message);
				return;
			}
			await onReject(parsed.data.reason);
		} else {
			await handleSubmit((values) =>
				onApprove({
					severity: values.severity,
					description: values.description,
					radiusMeters: isPoint ? values.radiusMeters : undefined,
				})
			)();
		}
		closeConfirm();
	};

	return (
		<form className="space-y-4" onSubmit={handleSubmit(() => setPending("approve"))}>
			<div className="space-y-1.5">
				<label htmlFor="proposal-public-description" className={labelClass}>
					Mô tả hiển thị trên bản đồ
				</label>
				<textarea
					id="proposal-public-description"
					rows={3}
					{...register("description")}
					className={fieldClass}
					disabled={submitting}
				/>
				<FieldError message={errors.description?.message} />
			</div>
			<div className="grid gap-3 sm:grid-cols-2">
				<Controller
					control={control}
					name="severity"
					render={({ field }) => (
						<div className="space-y-1.5">
							<span aria-hidden="true" className={labelClass}>
								Mức độ
							</span>
							<SelectField
								label="Mức độ"
								value={field.value}
								options={SEVERITY_OPTIONS}
								onChange={(value) => field.onChange(value)}
								disabled={submitting}
							/>
						</div>
					)}
				/>
				{isPoint && (
					<div className="space-y-1.5">
						<label htmlFor="proposal-radius" className={labelClass}>
							Bán kính vùng nguy hiểm (m)
						</label>
						<input
							id="proposal-radius"
							type="number"
							min={1}
							{...register("radiusMeters")}
							className={fieldClass}
							disabled={submitting}
						/>
						<FieldError message={errors.radiusMeters?.message} />
					</div>
				)}
			</div>
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					disabled={submitting}
					onClick={() => setPending("reject")}
				>
					Từ chối
				</Button>
				<Button type="submit" disabled={submitting}>
					Duyệt và hiển thị
				</Button>
			</div>

			<ConfirmModal
				isOpen={pending !== null}
				onClose={closeConfirm}
				onConfirm={confirm}
				isLoading={submitting}
				variant={pending === "reject" ? "danger" : "success"}
				title={pending === "reject" ? "Từ chối đề xuất" : "Duyệt điểm nguy hiểm"}
				description={
					pending === "reject" ? (
						<div className="space-y-3">
							<p>Đề xuất sẽ không hiển thị trên bản đồ. Người báo cáo sẽ thấy lý do này.</p>
							<div className="space-y-1.5">
								<label htmlFor="proposal-reject-reason" className={labelClass}>
									Lý do từ chối
								</label>
								<textarea
									id="proposal-reject-reason"
									rows={3}
									value={rejectReason}
									onChange={(event) => setRejectReason(event.target.value)}
									className={fieldClass}
									disabled={submitting}
								/>
								<FieldError message={rejectError} />
							</div>
						</div>
					) : (
						`Điểm nguy hiểm trên tuyến ${proposal.routeName} sẽ hiển thị trên bản đồ của mọi người dùng.`
					)
				}
				confirmText={pending === "reject" ? "Từ chối" : "Duyệt"}
				cancelText="Quay lại"
			/>
		</form>
	);
}
