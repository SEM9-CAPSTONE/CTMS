import { useState } from "react";
import { toast } from "../../../shared/components";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import type { CreateProposalPayload } from "../types";
import { proposalErrorMessage } from "../utils/proposal-errors";

export function useCreateDangerZoneProposal(routeId: string, onCreated: () => void) {
	const [submitting, setSubmitting] = useState(false);

	const submit = async (payload: CreateProposalPayload): Promise<boolean> => {
		if (submitting) return false;
		setSubmitting(true);
		try {
			await dangerZoneProposalsService.create(routeId, payload);
			toast.success(
				"Đã gửi đề xuất. Quản trị viên sẽ xem xét trước khi hiển thị.",
				"Điểm nguy hiểm"
			);
			onCreated();
			return true;
		} catch (failure) {
			toast.error(proposalErrorMessage(failure), "Điểm nguy hiểm");
			return false;
		} finally {
			setSubmitting(false);
		}
	};

	return { submitting, submit };
}
