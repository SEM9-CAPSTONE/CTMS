import { Package, Pencil, Wrench } from "lucide-react";
import { Button, DataTable, type DataTableColumn } from "../../../shared/components";
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
	const columns: DataTableColumn<EquipmentCatalogItem>[] = [
		{
			key: "name",
			header: "Thiết bị",
			render: (item) => (
				<div className="flex min-w-0 items-center gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#164027]">
						<Package className="size-4" />
					</div>
					<div className="min-w-0">
						<p className="font-extrabold text-[#10221b]">{item.name}</p>
						<div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#667a6d]">
							<span className="shrink-0">{item.category}</span>
							{item.maintenanceSchedule && (
								<>
									<span aria-hidden="true" className="text-[#c5d1c8]">
										•
									</span>
									<span
										className="flex min-w-0 items-center gap-1 text-[#7b8c82]"
										title={item.maintenanceSchedule}
									>
										<Wrench className="size-3 shrink-0" />
										<span className="truncate">{item.maintenanceSchedule}</span>
									</span>
								</>
							)}
						</div>
					</div>
				</div>
			),
		},
		{
			key: "quantity",
			header: "Số lượng",
			align: "right",
			className: "w-28",
			render: (item) => (
				<span className="font-bold tabular-nums text-[#10221b]">{item.quantityTotal}</span>
			),
		},
		{
			key: "price",
			header: "Giá thuê/ngày",
			align: "right",
			className: "w-40",
			render: (item) => (
				<span className="whitespace-nowrap font-bold tabular-nums text-[#10221b]">
					{formatCurrency(item.rentalPricePerDay)}
				</span>
			),
		},
		{
			key: "status",
			header: "Trạng thái",
			className: "w-44",
			render: (item) => <EquipmentCatalogStatusBadge status={item.status} />,
		},
		{
			key: "actions",
			header: "Thao tác",
			align: "right",
			className: "w-28",
			render: (item) => (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onEdit(item)}
					className="gap-1.5 font-bold"
				>
					<Pencil className="size-3.5" />
					Sửa
				</Button>
			),
		},
	];

	return (
		<DataTable
			ariaLabel="Danh sách thiết bị trong kho"
			columns={columns}
			rows={items}
			getRowKey={(item) => item.id}
			getRowTestId={(item) => `equipment-catalog-item-${item.id}`}
		/>
	);
}
