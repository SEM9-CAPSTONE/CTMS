import { ShieldAlert, TriangleAlert } from "lucide-react";
import type { RiskLevel } from "../types";

export interface WeatherSubmissionNoticeProps {
	riskLevel: RiskLevel | null | undefined;
	acknowledged: boolean;
	onAcknowledgedChange: (value: boolean) => void;
	disabled?: boolean;
}

/**
 * Submission rule for the Trip forecast: Green submits normally, Yellow submits with a
 * note for the Admin, Red needs the Host to confirm they know the risk.
 */
export function WeatherSubmissionNotice({
	riskLevel,
	acknowledged,
	onAcknowledgedChange,
	disabled = false,
}: WeatherSubmissionNoticeProps) {
	if (riskLevel === "yellow") {
		return (
			<p
				data-testid="weather-submission-yellow"
				className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"
			>
				<TriangleAlert className="mt-0.5 size-4 shrink-0" />
				Thời tiết ngày trekking ở mức Cảnh báo. Bạn vẫn gửi duyệt được, Admin sẽ xem xét kỹ dự báo
				này.
			</p>
		);
	}
	if (riskLevel === "red") {
		return (
			<div
				role="alert"
				data-testid="weather-submission-red"
				className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
			>
				<p className="flex items-start gap-2 font-extrabold">
					<ShieldAlert className="mt-0.5 size-4 shrink-0" />
					Dự báo thời tiết ngày trekking ở mức Nguy hiểm.
				</p>
				<p className="mt-1 pl-6 text-xs font-medium">
					Hãy cân nhắc đổi ngày. Nếu vẫn gửi, Admin sẽ thấy cảnh báo này khi duyệt.
				</p>
				<label className="mt-2 flex cursor-pointer items-center gap-2 pl-6 text-sm font-bold">
					<input
						type="checkbox"
						checked={acknowledged}
						disabled={disabled}
						onChange={(event) => onAcknowledgedChange(event.target.checked)}
						className="size-4 accent-red-700"
					/>
					Tôi đã biết chuyến đi đang có rủi ro thời tiết cao
				</label>
			</div>
		);
	}
	return null;
}
