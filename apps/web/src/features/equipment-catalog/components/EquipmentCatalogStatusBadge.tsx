import type { EquipmentCatalogStatus } from "../types";

const STATUS_STYLES: Record<EquipmentCatalogStatus, string> = {
	active: "border-emerald-200 bg-emerald-50 text-emerald-700",
	inactive: "border-amber-200 bg-amber-50 text-amber-700",
	retired: "border-slate-200 bg-slate-100 text-slate-600",
};

const STATUS_LABELS: Record<EquipmentCatalogStatus, string> = {
	active: "Đang hoạt động",
	inactive: "Ngừng hoạt động",
	retired: "Đã ngừng sử dụng",
};

export interface EquipmentCatalogStatusBadgeProps {
	status: EquipmentCatalogStatus;
}

export function EquipmentCatalogStatusBadge({ status }: EquipmentCatalogStatusBadgeProps) {
	return (
		<span
			className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}
		>
			{STATUS_LABELS[status]}
		</span>
	);
}
