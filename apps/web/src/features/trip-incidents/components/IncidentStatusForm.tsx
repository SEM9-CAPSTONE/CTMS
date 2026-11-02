import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../shared/components/Button";
import { incidentStatusLabels } from "../constants";
import type { IncidentStatus } from "../types";

export interface IncidentStatusFormProps {
	currentStatus: IncidentStatus;
	targetStatus: IncidentStatus;
	isSubmitting: boolean;
	onTargetStatusChange: (status: IncidentStatus) => void;
	onSubmit: () => Promise<void>;
}

const ALL_STATUSES: IncidentStatus[] = ["open", "investigating", "resolved", "closed"];

const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
	open: ["investigating", "resolved", "closed"],
	investigating: ["open", "resolved", "closed"],
	resolved: ["investigating", "closed"],
	closed: [],
};

export function IncidentStatusForm({
	currentStatus,
	targetStatus,
	isSubmitting,
	onTargetStatusChange,
	onSubmit,
}: IncidentStatusFormProps): ReactNode {
	const isSameStatus = targetStatus === currentStatus;
	const isAllowed =
		isSameStatus || (VALID_TRANSITIONS[currentStatus]?.includes(targetStatus) ?? false);
	const isButtonDisabled = isSubmitting || isSameStatus || !isAllowed;

	const getButtonLabel = () => {
		if (isSubmitting) return "Đang lưu...";
		if (isSameStatus) return "Sự cố đang ở trạng thái này";
		if (!isAllowed) return "Không thể chuyển sang trạng thái này";
		return `Chuyển sang "${incidentStatusLabels[targetStatus]}"`;
	};

	return (
		<div className="space-y-3">
			<div>
				<label htmlFor="incident-next-status" className="block text-xs font-bold text-[#44594c]">
					Trạng thái
				</label>
				<select
					id="incident-next-status"
					value={targetStatus}
					onChange={(e) => onTargetStatusChange(e.target.value as IncidentStatus)}
					disabled={isSubmitting}
					className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-[#164027] focus:outline-none"
				>
					{ALL_STATUSES.map((st) => (
						<option key={st} value={st}>
							{incidentStatusLabels[st]}
							{st === currentStatus ? " (Hiện tại)" : ""}
						</option>
					))}
				</select>
			</div>

			<Button
				size="sm"
				disabled={isButtonDisabled}
				onClick={() => void onSubmit()}
				className="w-full"
			>
				{isSubmitting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
				<span>{getButtonLabel()}</span>
			</Button>

			{isSameStatus && (
				<p className="text-[11px] text-slate-500 italic text-center">
					Vui lòng chọn trạng thái khác để cập nhật sự cố.
				</p>
			)}
		</div>
	);
}
