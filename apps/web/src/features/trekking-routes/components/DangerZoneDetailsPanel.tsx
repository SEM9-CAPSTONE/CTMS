import { Button } from "../../../shared/components/Button";
import type { RouteDangerZone } from "../types";
import { dangerZonePopupContent } from "../utils/danger-zone-popup";

export function DangerZoneDetailsPanel({
	zone,
	onClose,
}: {
	zone: RouteDangerZone;
	onClose: () => void;
}) {
	return (
		<aside
			aria-label="Thông tin điểm nguy hiểm"
			className="absolute top-14 left-3 z-30 max-h-[70%] max-w-[calc(100%_-_1.5rem)] overflow-auto rounded-lg bg-white p-3 pr-12 shadow-sm"
		>
			<Button
				variant="ghost"
				size="sm"
				aria-label="Đóng thông tin điểm nguy hiểm"
				onClick={onClose}
				className="absolute top-1 right-1"
			>
				×
			</Button>
			<div ref={(element) => element?.replaceChildren(dangerZonePopupContent(zone))} />
		</aside>
	);
}
