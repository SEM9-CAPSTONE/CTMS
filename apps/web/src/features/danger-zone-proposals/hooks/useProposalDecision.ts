import { useState } from "react";
import { toast } from "../../../shared/components";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import type { ApproveProposalPayload, DangerZoneProposal } from "../types";
import { proposalErrorMessage } from "../utils/proposal-errors";

const TOAST_TITLE = "Đề xuất điểm nguy hiểm";

/** Approve or reject one pending proposal; the caller refreshes the list with the result. */
export function useProposalDecision(
	proposalId: string,
	onDecided: (next: DangerZoneProposal) => void
) {
	const [submitting, setSubmitting] = useState(false);

	const run = async (
		call: () => Promise<DangerZoneProposal>,
		successMessage: string
	): Promise<boolean> => {
		if (submitting) return false;
		setSubmitting(true);
		try {
			const next = await call();
			toast.success(successMessage, TOAST_TITLE);
			onDecided(next);
			return true;
		} catch (failure) {
			toast.error(proposalErrorMessage(failure), TOAST_TITLE);
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return {
		submitting,
		approve: (payload: ApproveProposalPayload) =>
			run(
				() => dangerZoneProposalsService.approve(proposalId, payload),
				"Đã duyệt. Điểm nguy hiểm sẽ hiển thị trên bản đồ của mọi người dùng."
			),
		reject: (reason: string) =>
			run(() => dangerZoneProposalsService.reject(proposalId, reason), "Đã từ chối đề xuất."),
	};
}
