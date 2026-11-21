import { HttpError } from "../../../core/api/httpClient";
import { Button } from "../../../shared/components/Button";
import { type useMapParticipant, usePositionClock } from "../hooks/useActiveTripMap";
import type { MapParticipant } from "../types/active-trip-map";
import type { TripAlert } from "../types/trip-alert";
import {
	formatTime,
	freshnessLabels,
	locationFreshness,
	participantLabel,
	participantRoleLabel,
	relativePositionTime,
} from "../utils/participant-position";
import { alertSeverityLabels, alertTypeLabels } from "../utils/trip-alert";

export function HostMapParticipantDetail({
	member,
	detail,
	outsideRouteArea,
	alert,
}: {
	member: MapParticipant;
	alert?: TripAlert;
	outsideRouteArea: boolean;
	detail: ReturnType<typeof useMapParticipant>;
}) {
	const detailStatus = detail.error instanceof HttpError ? detail.error.status : undefined;
	const current = detail.data?.participant;
	const now = usePositionClock();
	const freshness = current
		? locationFreshness(
				current.lastSeenAt,
				Boolean(current.location),
				detail.data?.freshnessMaxAgeSeconds ?? 0,
				now
			)
		: "unavailable";
	return (
		<section
			aria-label="Chi tiết thành viên"
			className="sticky top-0 z-20 rounded-lg border border-emerald-900/20 bg-white p-3 shadow-sm"
		>
			<h5 className="font-semibold">
				{participantLabel(member)} · {participantRoleLabel(member.role)}
			</h5>
			{alert && (
				<p className="mt-1 font-medium text-amber-900" aria-label="Cảnh báo đang chọn">
					{alert.severity ? alertSeverityLabels[alert.severity] : alertTypeLabels[alert.alertType]}{" "}
					· ghi nhận {formatTime.format(new Date(alert.observedAt))}
				</p>
			)}
			{outsideRouteArea && (
				<p className="text-amber-800">
					Vị trí nằm ngoài khu vực tuyến. Chọn “Đến vị trí thành viên đã chọn” để xem vị trí đã ghi
					nhận.
				</p>
			)}
			{detail.isPending && <output>Đang tải chi tiết thành viên...</output>}
			{detail.isError && (
				<div role="alert">
					<p>
						{detailStatus === 404 || detailStatus === 403
							? "Chi tiết thành viên hiện không khả dụng hoặc bạn không có quyền xem."
							: detailStatus === 409
								? "Chuyến đi không còn diễn ra."
								: "Không thể tải chi tiết thành viên."}
					</p>
					{detailStatus !== 409 && (
						<Button variant="ghost" onClick={() => void detail.refetch()}>
							Thử lại
						</Button>
					)}
				</div>
			)}
			{detail.isSuccess && current && (
				<>
					<p>
						{freshnessLabels[freshness]}
						{current.lastSeenAt &&
							` · ${formatTime.format(new Date(current.lastSeenAt))} · ${relativePositionTime(current.lastSeenAt, now)}`}
					</p>
					{current.location && (
						<p>
							Tọa độ đã đồng bộ: {current.location.latitude.toFixed(5)},{" "}
							{current.location.longitude.toFixed(5)}
						</p>
					)}
					{current.safety.route &&
						!(
							alert?.alertType === "OFF_ROUTE" &&
							current.safety.route.type === "OFF_ROUTE" &&
							Date.parse(alert.observedAt) === Date.parse(current.safety.route.eventTime)
						) && (
							<p>
								{current.safety.route.type === "OFF_ROUTE"
									? "Ghi nhận lệch tuyến"
									: "Ghi nhận trở lại tuyến"}
								{current.safety.route.eventTime &&
									` · ${formatTime.format(new Date(current.safety.route.eventTime))}`}
							</p>
						)}
					{freshness === "stale" && (
						<p className="text-amber-800">
							Vị trí và sự kiện trên là lần ghi nhận trước đây. Cần cập nhật dữ liệu để xác định
							tình trạng hiện tại.
						</p>
					)}
					{current.safety.gps?.type === "GPS_DEGRADED" && <p>Đã ghi nhận tín hiệu định vị yếu</p>}
				</>
			)}
		</section>
	);
}
