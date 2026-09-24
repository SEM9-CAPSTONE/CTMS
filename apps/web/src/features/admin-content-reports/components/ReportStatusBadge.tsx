import { REPORT_STATUS_LABELS } from "../constants";
import type { ReportStatus } from "../types";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
	return (
		<span className="inline-flex whitespace-nowrap rounded-full bg-[#e8f0e6] px-3 py-1 text-xs font-bold text-[#164027]">
			{REPORT_STATUS_LABELS[status]}
		</span>
	);
}
