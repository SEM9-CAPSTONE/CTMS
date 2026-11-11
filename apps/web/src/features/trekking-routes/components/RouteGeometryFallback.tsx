import { type RefObject, useState } from "react";
import type { GeoJsonLineString, Position } from "../types";
import { addVertex, moveVertex } from "../utils/route-geometry";
import { DEFAULT_ROUTE_CENTER } from "../utils/route-map";

interface Props {
	value: GeoJsonLineString;
	disabled: boolean;
	selected: number | null;
	containerRef: RefObject<HTMLDivElement>;
	onChange: (value: GeoJsonLineString) => void;
	onSelect: (index: number) => void;
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
	disabled,
	selected,
	containerRef,
	onChange,
	onSelect,
}: Props) {
	const [dragging, setDragging] = useState<number | null>(null);
	const update = (index: number, x: number, y: number) => {
		if (containerRef.current)
			onChange(moveVertex(value, index, position(x, y, containerRef.current)));
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
						onChange(
							addVertex(value, position(event.clientX, event.clientY, containerRef.current))
						);
				}}
			/>
			{value.coordinates.map(([lng, lat], index) => {
				const label = `Đỉnh ${index + 1}`;
				const symbol = String(index + 1);
				return (
					<button
						key={`${index}-${lng}-${lat}`}
						type="button"
						aria-label={label}
						className={`-translate-x-1/2 -translate-y-1/2 absolute z-10 flex size-8 items-center justify-center rounded-full border-2 border-white text-xs font-black text-white shadow ${selected === index ? "bg-orange-600 ring-4 ring-orange-200" : "bg-[#164027]"}`}
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
						onPointerMove={(event) => {
							if (dragging === index) update(index, event.clientX, event.clientY);
						}}
						onPointerUp={(event) => {
							if (dragging === index) update(index, event.clientX, event.clientY);
							setDragging(null);
						}}
					>
						{symbol}
					</button>
				);
			})}
		</>
	);
}
