import { useEffect, useMemo, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import type { ParticipantSelection } from "../types/active-trip-map";
import type { TripAlert } from "../types/trip-alert";
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
import { useMapParticipant, usePositionClock, useTripMonitoring } from "./useActiveTripMap";

export function useHostTripMonitoring(
	hostId: string,
	tripId: string,
	selection: ParticipantSelection | undefined,
	onSelect: (value?: ParticipantSelection) => void
) {
	const maps = useTripMonitoring(hostId, tripId);
	const [alertNotice, setAlertNotice] = useState("");
	const [alertKey, setAlertKey] =
		useState<Pick<TripAlert, "participantId" | "role" | "alertType">>();
	const [focusRequest, setFocusRequest] = useState<{ point: [number, number]; sequence: number }>();
	const alertStatus =
		maps.data?.alertError instanceof HttpError ? maps.data.alertError.status : undefined;
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
	const chosenAlert = maps.data?.alerts?.alerts.find(
		(alert) =>
			alert.participantId === selected?.participantId &&
			alert.role === selected.role &&
			alert.participantId === alertKey?.participantId &&
			alert.role === alertKey.role &&
			alert.alertType === alertKey.alertType
	);
	const detail = useMapParticipant(hostId, member ? selected : undefined, maps.dataUpdatedAt);
	useEffect(() => {
		if (alertStatus === 409) onSelect(undefined);
	}, [alertStatus, onSelect]);
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

	const selectAlert = (alert: TripAlert) => {
		const participant = trip?.participants.find(
			(item) => item.id === alert.participantId && item.role === alert.role
		);
		if (!participant) {
			setAlertNotice(
				"Thành viên trong cảnh báo không còn dữ liệu vị trí trong danh sách chuyến đi. Hãy làm mới dữ liệu."
			);
			return;
		}
		onSelect({ tripId, role: participant.role, participantId: participant.id });
		setAlertKey(alert);
		setAlertNotice(
			participant.location ? "" : "Thành viên chưa có dữ liệu vị trí để mở trên bản đồ."
		);
		const location = participant.location;
		if (location)
			setFocusRequest((current) => ({
				point: [location.longitude, location.latitude],
				sequence: (current?.sequence ?? 0) + 1,
			}));
	};
	return {
		maps,
		trip,
		now,
		member,
		detail,
		selected,
		geometry,
		markers,
		removedNotice,
		selectAlert,
		alertNotice,
		focusRequest,
		chosenAlert,
	};
}
