import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { Position } from "../types";

const INITIAL_VIEW = { x: 0, y: 0, size: 100 };

export function useMapViewport(enabled: boolean, canDrag: boolean) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [view, setView] = useState(INITIAL_VIEW);
	const drag = useRef<{ x: number; y: number; view: typeof INITIAL_VIEW; scale: number }>();
	const reset = () => setView(INITIAL_VIEW);
	const zoom = useCallback((factor: number) => {
		setView((current) => {
			const size = Math.max(5, Math.min(400, current.size * factor));
			return {
				x: current.x + (current.size - size) / 2,
				y: current.y + (current.size - size) / 2,
				size,
			};
		});
	}, []);
	useEffect(() => {
		const svg = svgRef.current;
		if (!enabled || !svg) return;
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			zoom(event.deltaY < 0 ? 0.8 : 1.25);
		};
		svg.addEventListener("wheel", onWheel, { passive: false });
		return () => svg.removeEventListener("wheel", onWheel);
	}, [enabled, zoom]);

	const toMapPoint = (clientX: number, clientY: number): Position => {
		const rect = svgRef.current?.getBoundingClientRect();
		if (!rect || !rect.width || !rect.height)
			return [view.x + view.size / 2, view.y + view.size / 2];
		const scale = Math.min(rect.width, rect.height) / view.size;
		return [
			view.x + (clientX - rect.left - (rect.width - view.size * scale) / 2) / scale,
			view.y + (clientY - rect.top - (rect.height - view.size * scale) / 2) / scale,
		];
	};
	const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
		if (!canDrag || event.button !== 0) return;
		const rect = event.currentTarget.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		drag.current = {
			x: event.clientX,
			y: event.clientY,
			view,
			scale: Math.min(rect.width, rect.height) / view.size,
		};
		event.currentTarget.setPointerCapture?.(event.pointerId);
	};
	const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
		const start = drag.current;
		if (!start) return;
		setView({
			x: start.view.x - (event.clientX - start.x) / start.scale,
			y: start.view.y - (event.clientY - start.y) / start.scale,
			size: start.view.size,
		});
	};
	const stopDragging = () => {
		drag.current = undefined;
	};
	return {
		svgRef,
		viewBox: `${view.x} ${view.y} ${view.size} ${view.size}`,
		zoomIn: () => zoom(0.8),
		zoomOut: () => zoom(1.25),
		reset,
		toMapPoint,
		onPointerDown,
		onPointerMove,
		onPointerUp: stopDragging,
		onPointerCancel: stopDragging,
	};
}
