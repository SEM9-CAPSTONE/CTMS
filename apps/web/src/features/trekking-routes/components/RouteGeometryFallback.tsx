import { type RefObject, useState } from "react";
import type { GeoJsonLineString, Position } from "../types";
import { type RouteLineHit, findRouteLineHit } from "../utils/route-line-hit";
import { DEFAULT_ROUTE_CENTER, DRAWING_POINT_CLASS, drawingPointLabel } from "../utils/route-map";

interface Props {
	value: GeoJsonLineString;
	waypoints: Position[];
	disabled: boolean;
	selected: number | null;
	containerRef: RefObject<HTMLDivElement>;
	onChange: (waypoints: Position[]) => void;
	onSelect: (index: number) => void;
	onInsert: (hit: RouteLineHit) => void;
}
function position(x: number, y: number, element: HTMLDivElement): Position {
	const rect = element.getBoundingClientRect();
	if (!rect.width || !rect.height) return DEFAULT_ROUTE_CENTER;
	const clamp = (n: number) => Math.min(Math.max(n, 0), 1);
	return [
		Number((-180 + clamp((x - rect.left) / rect.width) * 360).toFixed(6)),
		Number((90 - clamp((y - rect.top) / rect.height) * 180).toFixed(6)),
	];
}
export function RouteGeometryFallback({
	value,
	waypoints,
	disabled,
	selected,
	containerRef,
	onChange,
	onSelect,
	onInsert,
}: Props) {
	const [dragging, setDragging] = useState<number | null>(null);
	const update = (index: number, x: number, y: number) => {
		if (!containerRef.current) return;
		const next = [...waypoints];
		next[index] = position(x, y, containerRef.current);
		onChange(next);
	};
	return (
		<>
			<button
				type="button"
				aria-label="Bản đồ vẽ tuyến"
				disabled={disabled}
				className="absolute inset-0 cursor-crosshair"
				onClick={(event) => {
					if (containerRef.current)
						onChange([...waypoints, position(event.clientX, event.clientY, containerRef.current)]);
				}}
			/>
			<svg
				aria-hidden="true"
				viewBox="0 0 100 100"
				preserveAspectRatio="none"
				className="pointer-events-none absolute inset-0 h-full w-full"
			>
				<polyline
					data-testid="drawing-line"
					pointerEvents={disabled ? "none" : "stroke"}
					onClick={(event) => {
						if (disabled || !containerRef.current) return;
						const rect = containerRef.current.getBoundingClientRect();
						const hit = findRouteLineHit(
							value.coordinates,
							{ x: event.clientX, y: event.clientY },
							([lng, lat]) => ({
								x: rect.left + ((lng + 180) / 360) * rect.width,
								y: rect.top + ((90 - lat) / 180) * rect.height,
							}),
							10
						);
						if (hit) onInsert(hit);
					}}
					points={value.coordinates
						.map(([lng, lat]) => `${((lng + 180) / 360) * 100},${((90 - lat) / 180) * 100}`)
						.join(" ")}
					fill="none"
					stroke="#ef6c35"
					strokeWidth="5"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			{waypoints.map(([lng, lat], index) => (
				<button
					key={`${index}-${lng}-${lat}`}
					type="button"
					aria-label={drawingPointLabel(index)}
					className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 touch-none ${DRAWING_POINT_CLASS} ${selected === index ? "ring-4 ring-orange-200" : ""}`}
					style={{ left: `${((lng + 180) / 360) * 100}%`, top: `${((90 - lat) / 180) * 100}%` }}
					onClick={(event) => {
						event.stopPropagation();
						onSelect(index);
					}}
					onPointerDown={(event) => {
						if (!disabled) {
							event.currentTarget.setPointerCapture(event.pointerId);
							setDragging(index);
						}
					}}
					onPointerCancel={() => setDragging(null)}
					onPointerUp={(event) => {
						if (dragging === index) update(index, event.clientX, event.clientY);
						setDragging(null);
					}}
				/>
			))}
		</>
	);
}
