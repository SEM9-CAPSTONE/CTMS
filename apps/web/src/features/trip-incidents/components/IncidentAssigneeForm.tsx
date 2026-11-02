import { UserCheck, UserX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../../shared/components/Button";

export interface IncidentAssigneeFormProps {
	assigneeId: string;
	currentAssignedTo: string | null;
	isSubmitting: boolean;
	onAssigneeIdChange: (val: string) => void;
	onAssign: (assignTo: string | null) => Promise<void>;
}

export function IncidentAssigneeForm({
	assigneeId,
	currentAssignedTo,
	isSubmitting,
	onAssigneeIdChange,
	onAssign,
}: IncidentAssigneeFormProps): ReactNode {
	return (
		<div className="rounded-xl border border-slate-200 p-4">
			<h3 className="font-extrabold text-[#10221b]">Phân công xử lý</h3>
			<div className="mt-3 space-y-3">
				<div>
					<label htmlFor="incident-assignee-id" className="block text-xs font-bold text-[#44594c]">
						Mã người xử lý (User ID)
					</label>
					<input
						id="incident-assignee-id"
						type="text"
						value={assigneeId}
						onChange={(e) => onAssigneeIdChange(e.target.value)}
						placeholder="UUID người phụ trách..."
						disabled={isSubmitting}
						className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-[#164027] focus:outline-none"
					/>
				</div>

				<div className="flex gap-2">
					<Button
						size="sm"
						disabled={isSubmitting || !assigneeId.trim()}
						onClick={() => void onAssign(assigneeId.trim())}
						className="flex-1"
					>
						<UserCheck className="mr-1 size-3.5" />
						<span>Phân công</span>
					</Button>
					{currentAssignedTo && (
						<Button
							size="sm"
							variant="outline"
							disabled={isSubmitting}
							onClick={() => {
								onAssigneeIdChange("");
								void onAssign(null);
							}}
						>
							<UserX className="mr-1 size-3.5" />
							<span>Hủy</span>
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
