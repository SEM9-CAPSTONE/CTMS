import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { HttpError } from "../../../core/api/httpClient";
import { Button } from "../../../shared/components/Button";
import { RouteCheckpointMap } from "../../trekking-routes/components/RouteCheckpointMap";
import { useActiveTripMaps, useMapParticipant, usePositionClock } from "../hooks/useActiveTripMap";
import type { ParticipantSelection } from "../types/active-trip-map";

import {
	formatTime,
	freshnessLabels,
	isOutsideRouteArea,
	locationFreshness,
	participantLabel,
	participantMapCode,
	participantRoleLabel,
	relativePositionTime,
} from "../utils/participant-position";
import { HostMapParticipantDetail } from "./HostMapParticipantDetail";
import { HostMonitoringParticipants } from "./HostMonitoringParticipants";

const ignoreLocationSelection = () => {};

export function HostActiveTripMap({
	hostId,
	tripId,
	selection,
	onSelect,
	rosterContainer,
}: {
	rosterContainer?: HTMLElement | null;
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
	const maps = useActiveTripMaps(hostId, true);
	const now = usePositionClock();
	const sourceTrip = maps.data?.items.find((item) => item.id === tripId);
	const trip = useMemo(
		() =>
			sourceTrip
				? {
						...sourceTrip,
						participants: sourceTrip.participants.map((participant) => ({
							...participant,
							outsideRouteArea: isOutsideRouteArea(participant.location, sourceTrip.route.geometry),
							freshness: locationFreshness(
								participant.lastSeenAt,
								Boolean(participant.location),
								maps.data?.freshnessMaxAgeSeconds ?? 0,
								now
							),
						})),
					}
				: undefined,
		[sourceTrip, maps.data?.freshnessMaxAgeSeconds, now]
	);
	const [removedNotice, setRemovedNotice] = useState(false);
	const selected = selection?.tripId === tripId ? selection : undefined;
	const member = trip?.participants.find(
		(item) => item.id === selected?.participantId && item.role === selected.role
	);
	const detail = useMapParticipant(hostId, member ? selected : undefined);
	const selectionRemoved = Boolean(selected && maps.isSuccess && !member);
	const geometry = trip?.route.geometry;
	const markers = useMemo(
		() =>
			trip?.participants.flatMap((participant, index) =>
				participant.location
					? [
							{
								id: `${participant.role}:${participant.id}`,
								code: participantMapCode(participant.role, index),
								point: [participant.location.longitude, participant.location.latitude] as [
									number,
									number,
								],
								label: `${participantLabel(participant)} · ${participantRoleLabel(participant.role)} · ${freshnessLabels[participant.freshness]}${participant.lastSeenAt ? ` · ${formatTime.format(new Date(participant.lastSeenAt))} · ${relativePositionTime(participant.lastSeenAt, now)}` : ""}`,
								stale: participant.freshness === "stale",
								selected: member?.id === participant.id && member.role === participant.role,
								onSelect: () =>
									onSelect({ tripId, role: participant.role, participantId: participant.id }),
							},
						]
					: []
			) ?? [],
		[trip, member, onSelect, tripId, now]
	);

	useEffect(() => {
		if (selectionRemoved) {
			setRemovedNotice(true);
			onSelect(undefined);
		} else if (selected) setRemovedNotice(false);
	}, [selectionRemoved, onSelect, selected]);

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

	const roster =
		trip.participants.length === 0 ? (
			<p>Chưa có thành viên trong chuyến đi.</p>
		) : (
			<HostMonitoringParticipants
				participants={trip.participants}
				member={member}
				tripId={tripId}
				now={now}
				onSelect={onSelect}
			/>
		);

	return (
		<section aria-label="Vị trí chuyến đi" className="min-w-0 space-y-3">
			<div className="flex items-center justify-between gap-3">
				<h4 className="font-bold">{trip.route.name}</h4>
			</div>
			<p className="text-sm text-slate-700">
				C · Người tham gia, P · Người hỗ trợ. Ô nét đứt biểu thị vị trí cũ.
			</p>
			<RouteCheckpointMap
				geometry={geometry}
				checkpoints={trip.route.checkpoints}
				monitoringMarkers={markers}
				onMonitoringGroupsChange={handleGroupsChange}
				radiusMeters={0}
				disabled
				onSelectLocation={ignoreLocationSelection}
			/>
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
