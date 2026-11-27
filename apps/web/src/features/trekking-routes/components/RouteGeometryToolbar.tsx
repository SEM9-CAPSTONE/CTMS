import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { Position } from "../types";

interface Props {
	waypoints: Position[];
	canUndo: boolean;
	onUndo: () => void;
	disabled: boolean;
	selected: number | null;
	onRemove: (index: number) => void;
	onClear: () => void;
	onSelect: (index: number | null) => void;
}
export function RouteGeometryToolbar({
	waypoints,
	canUndo,
	onUndo,
	disabled,
	selected,
	onRemove,
	onClear,
	onSelect,
}: Props) {
	return (
		<div className="mt-3 flex flex-wrap gap-2">
			<button
				type="button"
				disabled={disabled || selected === null}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => {
					if (selected !== null) onRemove(selected);
					onSelect(null);
				}}
			>
				<Trash2 className="mr-1 inline size-4" />
				<span>Xóa điểm đã chọn</span>
			</button>
			<button
				type="button"
				disabled={disabled || !canUndo}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => {
					onUndo();
					onSelect(null);
				}}
			>
				<Undo2 className="mr-1 inline size-4" />
				<span>Hoàn tác</span>
			</button>
			<button
				type="button"
				disabled={disabled || !waypoints.length}
				className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-40"
				onClick={() => {
					onClear();
					onSelect(null);
				}}
			>
				<RotateCcw className="mr-1 inline size-4" />
				<span>Xóa và vẽ lại</span>
			</button>
		</div>
	);
}
