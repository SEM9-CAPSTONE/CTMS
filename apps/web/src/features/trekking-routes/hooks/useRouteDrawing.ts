import { useEffect, useRef, useState } from "react";
import {
	type GeoJsonLineString,
	type Position,
	ROUTE_DRAWING_MODES,
	type RouteDrawing,
	type RouteDrawingMode,
} from "../types";
import {
	type DrawingSnapshot,
	type RouteEdit,
	RouteEditError,
	SegmentRoutingError,
	resolveRouteEdit,
	restoreDrawing,
	samePosition,
	segmentDraft,
	serializeDrawing,
} from "../utils/hybrid-route";

const ROUTING_DEBOUNCE_MS = 400;
const HISTORY_LIMIT = 50;
type FailedEdit = {
	edit: RouteEdit;
	message: string;
	segmentIndex?: number;
	connection?: GeoJsonLineString;
};

interface Options {
	value: GeoJsonLineString;
	initialDrawing?: RouteDrawing;
	onChange: (geometry: GeoJsonLineString, drawing?: RouteDrawing) => void;
	onBlockedChange?: (blocked: boolean) => void;
}

export function useRouteDrawing({ value, initialDrawing, onChange, onBlockedChange }: Options) {
	const [committed, setCommitted] = useState(() => restoreDrawing(value, initialDrawing));
	const current = useRef(committed);
	const history = useRef<DrawingSnapshot[]>([]);
	const [snapping, setSnapping] = useState(true);
	const [blocked, setBlocked] = useState(false);
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<FailedEdit>();
	const [reconnectIndex, setReconnectIndex] = useState<number>();
	const running = useRef<{ controller: AbortController; timer?: number }>();
	const handlers = useRef({ onChange, onBlockedChange });

	useEffect(() => {
		handlers.current = { onChange, onBlockedChange };
	}, [onChange, onBlockedChange]);
	useEffect(
		() => () => {
			running.current?.controller.abort();
			window.clearTimeout(running.current?.timer);
		},
		[]
	);

	function block(next: boolean) {
		setBlocked(next);
		handlers.current.onBlockedChange?.(next);
	}

	function cancelEdit() {
		running.current?.controller.abort();
		window.clearTimeout(running.current?.timer);
		running.current = undefined;
		setLoading(false);
		setFailure(undefined);
		setReconnectIndex(undefined);
		block(false);
	}

	function commit(next: DrawingSnapshot, remember = true) {
		if (remember) {
			history.current.push(current.current);
			if (history.current.length > HISTORY_LIMIT) history.current.shift();
		}
		current.current = next;
		setCommitted(next);
		const { geometry, drawing } = serializeDrawing(next);
		handlers.current.onChange(geometry, drawing);
		cancelEdit();
	}

	function startEdit(edit: RouteEdit) {
		cancelEdit();
		const job: NonNullable<typeof running.current> = { controller: new AbortController() };
		running.current = job;
		const needsRouting = edit.segments.some(
			(segment) => !segment.geometry && segment.mode === ROUTE_DRAWING_MODES.SMART
		);
		block(true);
		setLoading(needsRouting);
		const resolve = async () => {
			try {
				const next = await resolveRouteEdit(edit, job.controller.signal);
				if (running.current === job && !job.controller.signal.aborted) commit(next);
			} catch (error) {
				if (running.current !== job || job.controller.signal.aborted) return;
				running.current = undefined;
				setLoading(false);
				setFailure({
					edit,
					message:
						error instanceof RouteEditError ? error.message : "Không thể cập nhật tuyến đường.",
					segmentIndex: error instanceof SegmentRoutingError ? error.index : undefined,
					connection: error instanceof SegmentRoutingError ? error.connection : undefined,
				});
			}
		};
		if (needsRouting) job.timer = window.setTimeout(() => void resolve(), ROUTING_DEBOUNCE_MS);
		else void resolve();
	}

	function updateWaypoints(next: Position[]) {
		const { waypoints, segments } = current.current;
		if (!waypoints.length && next.length === 1) {
			commit({ waypoints: next, segments: [] });
		} else if (next.length === waypoints.length + 1) {
			const endpoint = next[next.length - 1];
			if (samePosition(endpoint, waypoints[waypoints.length - 1])) return;
			startEdit({
				waypoints: [...waypoints, endpoint],
				segments: [
					...segments,
					segmentDraft(snapping ? ROUTE_DRAWING_MODES.SMART : ROUTE_DRAWING_MODES.MANUAL),
				],
				movable: segments.length ? [waypoints.length] : [0, 1],
				allowManualConnector: segments.length > 0,
			});
		} else if (next.length === waypoints.length) {
			const moved = next.findIndex((point, index) => !samePosition(point, waypoints[index]));
			if (moved < 0) return;
			if (!segments.length) {
				commit({ waypoints: next, segments: [] });
				return;
			}
			startEdit({
				waypoints: next,
				segments: segments.map((segment, index) =>
					index === moved || index + 1 === moved ? { id: segment.id, mode: segment.mode } : segment
				),
				movable: [moved],
			});
		}
	}

	function remove(index: number, chosenMode?: RouteDrawingMode) {
		const { waypoints, segments } = current.current;
		if (index < 0 || index >= waypoints.length) return;
		const next = waypoints.filter((_, waypoint) => waypoint !== index);
		if (index === 0 || index === waypoints.length - 1) {
			commit({
				waypoints: next,
				segments: segments.filter((_, segment) => segment !== Math.max(0, index - 1)),
			});
			return;
		}
		const before = segments[index - 1];
		const after = segments[index];
		if (before.mode !== after.mode && !chosenMode) {
			cancelEdit();
			setReconnectIndex(index);
			block(true);
			return;
		}
		startEdit({
			waypoints: next,
			segments: [
				...segments.slice(0, index - 1),
				segmentDraft(chosenMode ?? before.mode),
				...segments.slice(index + 1),
			],
			movable: [],
		});
	}

	return {
		waypoints: committed.waypoints,
		snapping,
		setSnapping,
		hasManual: committed.segments.some((segment) => segment.mode === ROUTE_DRAWING_MODES.MANUAL),
		blocked,
		loading,
		error: failure?.message,
		canFallback: failure?.segmentIndex !== undefined,
		canConnectToPath: Boolean(failure?.connection),
		canUndo: history.current.length > 0 || blocked,
		reconnecting: reconnectIndex !== undefined,
		updateWaypoints,
		remove,
		cancelEdit,
		clear() {
			commit({ waypoints: [], segments: [] });
			setSnapping(true);
		},
		undo() {
			if (blocked) {
				cancelEdit();
				return;
			}
			const previous = history.current.pop();
			if (previous) commit(previous, false);
		},
		reconnect(mode: RouteDrawingMode) {
			if (reconnectIndex !== undefined) remove(reconnectIndex, mode);
		},
		retry() {
			if (failure) startEdit(failure.edit);
		},
		drawFailedSegmentManually() {
			if (failure?.segmentIndex === undefined) return;
			startEdit({
				...failure.edit,
				segments: failure.edit.segments.map((segment, index) =>
					index === failure.segmentIndex
						? { id: segment.id, mode: ROUTE_DRAWING_MODES.MANUAL }
						: segment
				),
			});
		},
		connectToPath() {
			if (!failure?.connection) return;
			const { waypoints, segments } = failure.edit;
			const geometry = failure.connection;
			const last = segments[segments.length - 1];
			startEdit({
				waypoints: [
					...waypoints.slice(0, -1),
					geometry.coordinates[0],
					geometry.coordinates[geometry.coordinates.length - 1],
				],
				segments: [
					...segments.slice(0, -1),
					segmentDraft(ROUTE_DRAWING_MODES.MANUAL),
					{ ...last, geometry },
				],
				movable: [],
			});
		},
	};
}
