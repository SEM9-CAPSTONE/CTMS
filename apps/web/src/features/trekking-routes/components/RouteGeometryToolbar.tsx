import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { GeoJsonLineString } from "../types";
import { emptyLineString, removeLastVertex, removeVertex } from "../utils/route-geometry";

interface Props {
	value: GeoJsonLineString;
	disabled: boolean;
	selected: number | null;
	onChange: (value: GeoJsonLineString) => void;
	onSelect: (index: number | null) => void;
}
export function RouteGeometryToolbar({ value, disabled, selected, onChange, onSelect }: Props) {
	return (
		<div className="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				disabled={disabled || selected === null}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => {
					if (selected !== null) onChange(removeVertex(value, selected));
					onSelect(null);
				}}
			>
				<Trash2 className="mr-1 inline size-4" />
				<span>Xóa điểm đã chọn</span>
			</button>
			<button
				type="button"
				disabled={disabled || !value.coordinates.length}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => onChange(removeLastVertex(value))}
			>
				<Undo2 className="mr-1 inline size-4" />
				<span>Xóa điểm cuối</span>
			</button>
			<button
				type="button"
				disabled={disabled || !value.coordinates.length}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => {
					onChange(emptyLineString());
					onSelect(null);
				}}
			>
				<RotateCcw className="mr-1 inline size-4" />
				<span>Xóa và vẽ lại</span>
			</button>
		</div>
	);
}
