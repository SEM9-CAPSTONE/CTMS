import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../shared/components/Button";
import { incidentStatusLabels } from "../constants";
import type { IncidentStatus } from "../types";

export interface IncidentStatusFormProps {
	currentStatus: IncidentStatus;
	targetStatus: IncidentStatus;
	availableStatuses: IncidentStatus[];
	isSubmitting: boolean;
	onTargetStatusChange: (status: IncidentStatus) => void;
	onSubmit: () => Promise<void>;
}

export function IncidentStatusForm({
	currentStatus,
	targetStatus,
	availableStatuses,
	isSubmitting,
	onTargetStatusChange,
	onSubmit,
}: IncidentStatusFormProps): ReactNode {
	return (
		<div className="rounded-xl border border-slate-200 p-4">
			<h3 className="font-extrabold text-[#10221b]">Cập nhật trạng thái</h3>
			{availableStatuses.length > 0 ? (
				<div className="mt-3 space-y-3">
					<div>
						<label
							htmlFor="incident-next-status"
							className="block text-xs font-bold text-[#44594c]"
						>
							Trạng thái tiếp theo
						</label>
						<select
							id="incident-next-status"
							value={targetStatus}
							onChange={(e) => onTargetStatusChange(e.target.value as IncidentStatus)}
							disabled={isSubmitting}
							className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-[#164027] focus:outline-none"
						>
							{availableStatuses.map((st) => (
								<option key={st} value={st}>
									{incidentStatusLabels[st]}
								</option>
							))}
						</select>
					</div>

					<Button
						size="sm"
						disabled={isSubmitting || targetStatus === currentStatus}
						onClick={() => void onSubmit()}
						className="w-full"
					>
						{isSubmitting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
						<span>Chuyển sang &quot;{incidentStatusLabels[targetStatus]}&quot;</span>
					</Button>
				</div>
			) : (
				<p className="mt-3 text-xs italic text-slate-500">
					Sự cố đã ở trạng thái kết thúc ({incidentStatusLabels[currentStatus]}). Không thể chuyển
					trạng thái.
				</p>
			)}
		</div>
	);
}
