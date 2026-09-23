import { Pencil } from "lucide-react";
import type { EquipmentCatalogItem } from "../types";
import { EquipmentCatalogStatusBadge } from "./EquipmentCatalogStatusBadge";

export interface EquipmentCatalogListProps {
	items: EquipmentCatalogItem[];
	onEdit: (item: EquipmentCatalogItem) => void;
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

export function EquipmentCatalogList({ items, onEdit }: EquipmentCatalogListProps) {
	return (
		<div className="space-y-3" aria-label="Danh sách thiết bị trong kho">
			{items.map((item) => (
				<div
					key={item.id}
					className="rounded-2xl border border-[#dfe8df] bg-white p-4 shadow-sm"
					data-testid={`equipment-catalog-item-${item.id}`}
				>
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<h3 className="truncate font-extrabold text-[#10221b]">{item.name}</h3>
							<p className="mt-1 text-xs font-semibold text-[#667a6d]">{item.category}</p>
						</div>
						<EquipmentCatalogStatusBadge status={item.status} />
					</div>
					<div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-[#52665b]">
						<span>Số lượng: {item.quantityTotal}</span>
						<span>Giá thuê/ngày: {formatCurrency(item.rentalPricePerDay)}</span>
					</div>
					{item.maintenanceSchedule && (
						<p className="mt-2 text-xs text-[#7b8c82]">Lịch bảo trì: {item.maintenanceSchedule}</p>
					)}
					<button
						type="button"
						onClick={() => onEdit(item)}
						className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-[#dfe8df] px-3 py-1.5 text-xs font-bold text-[#164027] hover:bg-[#f4f7f2]"
					>
						<Pencil className="size-3.5" />
						Sửa
					</button>
				</div>
			))}
		</div>
	);
}
