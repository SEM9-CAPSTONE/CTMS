import { Package, Pencil, Wrench } from "lucide-react";
import type { EquipmentCatalogItem } from "../types";
import { EquipmentCatalogStatusBadge } from "./EquipmentCatalogStatusBadge";

export interface EquipmentCatalogListProps {
	items: EquipmentCatalogItem[];
	onEdit: (item: EquipmentCatalogItem) => void;
}

function formatCurrency(value: number): string {
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
}

// One grid template shared by the header and every row so columns line up on desktop.
const ROW_GRID =
	"md:grid md:grid-cols-[minmax(0,1fr)_7rem_10rem_10rem_4.5rem] md:items-center md:gap-4";

export function EquipmentCatalogList({ items, onEdit }: EquipmentCatalogListProps) {
	return (
		<div className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-sm">
			<div
				aria-hidden="true"
				className={`hidden border-b border-[#e7eee7] bg-[#f8faf7] px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-[#8fa096] ${ROW_GRID}`}
			>
				<span>Thiết bị</span>
				<span className="text-right">Số lượng</span>
				<span className="text-right">Giá thuê/ngày</span>
				<span>Trạng thái</span>
				<span />
			</div>

			<ul aria-label="Danh sách thiết bị trong kho" className="divide-y divide-[#edf3ee]">
				{items.map((item) => (
					<li
						key={item.id}
						data-testid={`equipment-catalog-item-${item.id}`}
						className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 transition-colors hover:bg-[#fbfdfb] ${ROW_GRID}`}
					>
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#164027]">
								<Package className="size-4" />
							</div>
							<div className="min-w-0">
								<h3 className="truncate text-sm font-extrabold text-[#10221b]">{item.name}</h3>
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

						<p className="order-last w-full pl-12 text-xs font-semibold text-[#52665b] md:order-none md:contents">
							<span className="md:text-right md:text-sm md:font-bold md:tabular-nums md:text-[#10221b]">
								<span className="md:hidden">SL: </span>
								{item.quantityTotal}
							</span>
							<span aria-hidden="true" className="mx-1.5 text-[#c5d1c8] md:hidden">
								•
							</span>
							<span className="md:text-right md:text-sm md:font-bold md:tabular-nums md:text-[#10221b]">
								{formatCurrency(item.rentalPricePerDay)}
								<span className="md:hidden">/ngày</span>
							</span>
						</p>

						<div>
							<EquipmentCatalogStatusBadge status={item.status} />
						</div>

						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => onEdit(item)}
								className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-[#164027] hover:bg-[#eef4ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#164027]/30"
							>
								<Pencil className="size-3.5" />
								Sửa
							</button>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
