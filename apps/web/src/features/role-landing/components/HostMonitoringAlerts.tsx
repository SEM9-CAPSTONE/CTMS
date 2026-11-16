import { useEffect, useRef, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { Button } from "../../../shared/components/Button";
import type { ParticipantSelection } from "../types/active-trip-map";
import type { AlertSeverity, AlertType, TripAlert } from "../types/trip-alert";
import { alertSeverityFilterLabels, alertTypeLabels, filterTripAlerts } from "../utils/trip-alert";
import { HostMonitoringAlertRow } from "./HostMonitoringAlertRow";

interface Props {
	alerts: TripAlert[];
	error: unknown;
	maxAgeSeconds: number;
	now: number;
	selection?: ParticipantSelection;
	onSelect: (alert: TripAlert) => void;
	onRetry: () => void;
	onRefreshTrips: () => void;
	codes: Record<string, string>;
}

export function HostMonitoringAlerts({
	alerts,
	error,
	maxAgeSeconds,
	now,
	selection,
	onSelect,
	onRetry,
	onRefreshTrips,
	codes,
}: Props) {
	const [type, setType] = useState<AlertType | "">("");
	const [severity, setSeverity] = useState<AlertSeverity | "">("");
	const listRef = useRef<HTMLUListElement>(null);
	const filtered = filterTripAlerts(alerts, type, severity);
	const selectedAlerts = filtered.filter(
		(alert) => alert.participantId === selection?.participantId && alert.role === selection.role
	);
	const otherAlerts = filtered.filter((alert) => !selectedAlerts.includes(alert));
	const scrollKey = [type, severity, selection?.participantId, selection?.role].join(":");
	useEffect(() => {
		if (scrollKey && listRef.current) listRef.current.scrollTop = 0;
	}, [scrollKey]);
	const status = error instanceof HttpError ? error.status : undefined;
	if (error)
		return (
			<div role="alert" className="space-y-2">
				<p>
					{status === 404 || status === 403
						? "Cảnh báo chuyến đi không khả dụng hoặc bạn không có quyền xem."
						: status === 409
							? "Chuyến đi không còn diễn ra hoặc bản đồ hiện không khả dụng. Đã bỏ chọn thành viên."
							: "Không thể tải cảnh báo. Chưa thể xác nhận tình trạng thành viên."}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={status === 403 || status === 404 || status === 409 ? onRefreshTrips : onRetry}
				>
					{status === 403 || status === 404 || status === 409
						? "Làm mới danh sách chuyến"
						: "Thử lại"}
				</Button>
			</div>
		);
	return (
		<section aria-label="Danh sách cảnh báo" className="space-y-2">
			<div className="grid gap-2 sm:grid-cols-2">
				<label className="text-sm">
					Loại cảnh báo
					<select
						className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
						value={type}
						onChange={(event) => {
							setType(event.target.value as AlertType | "");
						}}
					>
						<option value="">Mọi loại</option>
						{Object.entries(alertTypeLabels).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
				<label className="text-sm">
					Mức độ cảnh báo
					<select
						className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"
						value={severity}
						onChange={(event) => {
							setSeverity(event.target.value as AlertSeverity | "");
						}}
					>
						<option value="">Mọi mức độ</option>
						{Object.entries(alertSeverityFilterLabels).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</label>
			</div>
			{severity && (
				<p className="text-sm text-slate-700">
					Bộ lọc mức độ chỉ áp dụng cho chậm tiến độ; không bao gồm cảnh báo lệch tuyến.
				</p>
			)}
			{filtered.length === 0 && (
				<output>
					{type || severity
						? "Không có cảnh báo phù hợp với bộ lọc."
						: "Không có cảnh báo lệch tuyến hoặc chậm tiến độ được ghi nhận."}
				</output>
			)}
			{filtered.length > 0 && (
				<ul
					ref={listRef}
					aria-label="Các cảnh báo của chuyến đi"
					className="max-h-80 overflow-y-auto overscroll-contain space-y-2 pr-2 focus-visible:outline-2 focus-visible:outline-emerald-800"
				>
					{selectedAlerts.length > 0 && (
						<li className="text-xs font-medium text-slate-700">Cảnh báo của người đang chọn</li>
					)}
					{[...selectedAlerts, ...otherAlerts].map((alert, index) => (
						<li key={`${alert.role}:${alert.participantId}:${alert.alertType}`}>
							{selectedAlerts.length > 0 && index === selectedAlerts.length && (
								<p className="mb-2 text-xs font-medium text-slate-700">Cảnh báo khác</p>
							)}
							<HostMonitoringAlertRow
								alert={alert}
								selection={selection}
								maxAgeSeconds={maxAgeSeconds}
								now={now}
								onSelect={onSelect}
								code={codes[`${alert.role}:${alert.participantId}`]}
							/>
						</li>
					))}
				</ul>
			)}
			{filtered.length === 0 && selection && (
				<p className="text-xs text-slate-600">
					Bản đồ vẫn giữ thành viên đang chọn. Đổi chuyến sẽ bỏ chọn.
				</p>
			)}
			<details className="text-sm text-slate-700">
				<summary className="cursor-pointer font-medium">Lưu ý về dữ liệu vị trí</summary>
				<p className="mt-2">Vị trí cũ hoặc chưa có vị trí không xác nhận tình trạng hiện tại.</p>
				<p className="mt-1">
					Thành viên mất tín hiệu định vị có thể không xuất hiện trong cảnh báo chậm tiến độ. Xem
					tab Thành viên để kiểm tra vị trí.
				</p>
			</details>
		</section>
	);
}
