import { useEffect, useRef, useState } from "react";
import {
	type GeoJsonLineString,
	type Position,
	ROUTE_DRAWING_MODES,
	type RouteDrawing,
} from "../types";
import {
	type DrawingSnapshot,
	type RouteEdit,
	RouteEditError,
	insertDrawingPoint,
	resolveRouteEdit,
	restoreDrawing,
	samePosition,
	segmentDraft,
	serializeDrawing,
} from "../utils/hybrid-route";
import type { RouteLineHit } from "../utils/route-line-hit";

const ROUTING_DEBOUNCE_MS = 400;
const HISTORY_LIMIT = 50;
type FailedEdit = {
	edit?: RouteEdit;
	message: string;
	pendingPoints?: Position[];
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
	const [blocked, setBlocked] = useState(false);
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<FailedEdit>();
	const running = useRef<{
		controller: AbortController;
		timer?: number;
		pendingPoints?: Position[];
	}>();
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

	function startEdit(edit: RouteEdit, pendingPoints?: Position[]) {
		cancelEdit();
		const job: NonNullable<typeof running.current> = {
			controller: new AbortController(),
			pendingPoints,
		};
		running.current = job;
		const needsRouting = edit.segments.some(
			(segment) => !segment.geometry && segment.mode === ROUTE_DRAWING_MODES.SMART
		);
		block(true);
		setLoading(needsRouting);
		const resolve = async () => {
			try {
				const next = await resolveRouteEdit(edit, job.controller.signal);
				if (running.current !== job || job.controller.signal.aborted) return;
				const following = job.pendingPoints?.shift();
				commit(next);
				if (following) appendPoint(following, job.pendingPoints);
			} catch (error) {
				if (running.current !== job || job.controller.signal.aborted) return;
				running.current = undefined;
				setLoading(false);
				setFailure({
					edit,
					message:
						error instanceof RouteEditError ? error.message : "Không thể cập nhật tuyến đường.",
					pendingPoints: job.pendingPoints,
				});
			}
		};
		if (needsRouting) job.timer = window.setTimeout(() => void resolve(), ROUTING_DEBOUNCE_MS);
		else void resolve();
	}

	function appendPoint(endpoint: Position, pendingPoints: Position[] = []) {
		const { waypoints, segments } = current.current;
		if (!waypoints.length) {
			commit({ waypoints: [endpoint], segments: [] });
			return;
		}
		if (samePosition(endpoint, waypoints[waypoints.length - 1])) {
			const following = pendingPoints.shift();
			if (following) appendPoint(following, pendingPoints);
			return;
		}
		startEdit(
			{
				waypoints: [...waypoints, endpoint],
				segments: [...segments, segmentDraft(ROUTE_DRAWING_MODES.SMART)],
				movable: segments.length ? [waypoints.length] : [0, 1],
			},
			pendingPoints
		);
	}

	function updateWaypoints(next: Position[]) {
		const { waypoints, segments } = current.current;
		if (next.length === waypoints.length + 1) {
			const endpoint = next[next.length - 1];
			if (running.current?.pendingPoints) running.current.pendingPoints.push(endpoint);
			else appendPoint(endpoint, failure?.pendingPoints ?? []);
		} else if (next.length === waypoints.length) {
			const moved = next.findIndex((point, index) => !samePosition(point, waypoints[index]));
			if (moved < 0) return;
			if (!segments.length) {
				const failedDestination = failure?.edit?.waypoints[1];
				commit({ waypoints: next, segments: [] });
				if (failedDestination) appendPoint(failedDestination, failure?.pendingPoints);
				return;
			}
			startEdit({
				waypoints: next,
				segments: segments.map((segment, index) =>
					index === moved || index + 1 === moved
						? { id: segment.id, mode: ROUTE_DRAWING_MODES.SMART }
						: segment
				),
				movable: [moved],
			});
		}
	}

	function remove(index: number) {
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
		startEdit({
			waypoints: next,
			segments: [
				...segments.slice(0, index - 1),
				segmentDraft(ROUTE_DRAWING_MODES.SMART),
				...segments.slice(index + 1),
			],
			movable: [],
		});
	}

	return {
		waypoints: committed.waypoints,
		blocked,
		loading,
		error: failure?.message,
		canRetry: Boolean(failure?.edit),
		canUndo: history.current.length > 0 || blocked,
		updateWaypoints,
		insertPoint(hit: RouteLineHit) {
			try {
				const next = insertDrawingPoint(current.current, hit);
				if (next) commit(next);
			} catch (error) {
				cancelEdit();
				setFailure({
					message: error instanceof RouteEditError ? error.message : "Không thể thêm điểm vẽ.",
				});
			}
		},
		remove,
		cancelEdit,
		clear() {
			commit({ waypoints: [], segments: [] });
		},
		undo() {
			if (blocked) {
				cancelEdit();
				return;
			}
			const previous = history.current.pop();
			if (previous) commit(previous, false);
		},
		retry() {
			if (failure?.edit) startEdit(failure.edit, failure.pendingPoints);
		},
	};
}
