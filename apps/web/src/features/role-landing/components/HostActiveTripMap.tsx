import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { HttpError } from "../../../core/api/httpClient";
import { Button } from "../../../shared/components/Button";
import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import { useHostTripMonitoring } from "../hooks/useHostTripMonitoring";
import type { ParticipantSelection } from "../types/active-trip-map";
import { HostMonitoringRoster } from "./HostMonitoringRoster";

import { formatTime } from "../utils/participant-position";
import { HostMapParticipantDetail } from "./HostMapParticipantDetail";

const ignoreLocationSelection = () => {};

export function HostActiveTripMap({
	hostId,
	tripId,
	selection,
	onSelect,
	rosterContainer,
	onRefreshTrips,
}: {
	rosterContainer?: HTMLElement | null;
	onRefreshTrips: () => void;
	hostId: string;
	tripId: string;
	selection?: ParticipantSelection;
	onSelect: (value?: ParticipantSelection) => void;
}) {
	const [clusterSizes, setClusterSizes] = useState<number[]>([]);
	const handleGroupsChange = useCallback((sizes: number[]) => {
		const ordered = [...sizes].sort((a, b) => b - a);
		setClusterSizes((current) => (current.join(",") === ordered.join(",") ? current : ordered));
	}, []);
	const monitoring = useHostTripMonitoring(hostId, tripId, selection, onSelect);
	const { maps, trip, member, detail, geometry, markers, removedNotice, focusRequest } = monitoring;

	if (maps.isPending) return <output>Đang tải bản đồ chuyến đi...</output>;
	if (maps.isError)
		return (
			<div role="alert">
				<p>
					{maps.error instanceof HttpError && [403, 404].includes(maps.error.status)
						? "Bạn không có quyền xem bản đồ chuyến đi."
						: "Không thể tải bản đồ chuyến đi."}
				</p>
				<Button variant="ghost" onClick={() => void maps.refetch()}>
					Thử lại
				</Button>
			</div>
		);
	if (!trip || !geometry)
		return <p>Chuyến đi không còn trong danh sách đang diễn ra hoặc bạn không có quyền xem.</p>;

	const roster = (
		<HostMonitoringRoster
			monitoring={monitoring}
			tripId={tripId}
			onSelect={onSelect}
			onRefreshTrips={onRefreshTrips}
		/>
	);

	return (
		<section aria-label="Vị trí chuyến đi" className="min-w-0 space-y-3">
			<p className="text-sm text-slate-700">
				{maps.data?.refreshedAt
					? `${maps.data.alertError ? "Vị trí cập nhật" : "Vị trí và cảnh báo cùng làm mới"} lúc ${formatTime.format(new Date(maps.data.refreshedAt))}`
					: "Đang cập nhật dữ liệu giám sát"}{" "}
				· Tự làm mới mỗi 30 giây{maps.data?.alertError ? " · Chưa tải được cảnh báo" : ""}
			</p>
			<div className="flex items-center justify-between gap-3">
				<h4 className="font-bold">{trip.route.name}</h4>
			</div>
			<p className="text-sm text-slate-700">
				C · Người tham gia, P · Người hỗ trợ. Ô nét đứt biểu thị vị trí cũ.
			</p>
			<div className="isolate relative z-0">
				<RouteCheckpointMap
					geometry={geometry}
					checkpoints={trip.route.checkpoints}
					dangerZones={trip.route.dangerZones}
					monitoringMarkers={markers}
					onMonitoringGroupsChange={handleGroupsChange}
					monitoringFocus={focusRequest}
					radiusMeters={0}
					disabled
					onSelectLocation={ignoreLocationSelection}
				/>
			</div>
			{removedNotice && (
				<output className="text-sm text-slate-700">
					Thành viên đang chọn không còn trong chuyến đi. Đã bỏ chọn.
				</output>
			)}
			{member && (
				<HostMapParticipantDetail
					member={member}
					detail={detail}
					outsideRouteArea={member.outsideRouteArea}
					alert={monitoring.chosenAlert}
				/>
			)}
			<p
				aria-label="Hướng dẫn đọc vị trí thành viên"
				className="rounded-lg bg-slate-50 px-3 py-3 text-sm leading-relaxed text-slate-700"
			>
				{clusterSizes.length > 0 ? (
					<>
						Các cụm màu xanh đậm hiện có:{" "}
						<strong>{clusterSizes.map((size) => `${size} người`).join(", ")}</strong>. Số trong mỗi
						cụm là số người có vị trí gần nhau. Bấm cụm để phóng to; chọn từng người trong danh sách
						thành viên.
					</>
				) : markers.length > 0 ? (
					<>
						Đang hiển thị {markers.length} thành viên có vị trí. Chọn chấm vị trí trên bản đồ hoặc
						tên trong danh sách để xem chi tiết.
					</>
				) : (
					<>Chuyến này chưa có vị trí thành viên để hiển thị trên bản đồ.</>
				)}
			</p>
			{rosterContainer ? createPortal(roster, rosterContainer) : roster}
		</section>
	);
}
