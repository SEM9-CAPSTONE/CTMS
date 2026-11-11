import {
	AlertTriangle,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Package,
	Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { TripEquipmentPreparationItem } from "../types";
import { formatEquipmentCategory } from "./TripRentableEquipment";

export interface HostTripEquipmentPreparationProps {
	equipmentSummary: TripEquipmentPreparationItem[];
}

export function HostTripEquipmentPreparation({
	equipmentSummary,
}: HostTripEquipmentPreparationProps) {
	const [isExpanded, setIsExpanded] = useState<boolean>(false);
	const [categoryFilter, setCategoryFilter] = useState<string>("all");

	const categories = useMemo(() => {
		const set = new Set<string>();
		for (const item of equipmentSummary) {
			if (item.category) set.add(item.category);
		}
		return Array.from(set);
	}, [equipmentSummary]);

	const totalPieces = useMemo(() => {
		return equipmentSummary.reduce((acc, item) => acc + item.totalQuantity, 0);
	}, [equipmentSummary]);

	const missingItemsCount = useMemo(() => {
		return equipmentSummary.filter((item) => item.inventoryQuantity < item.totalQuantity).length;
	}, [equipmentSummary]);

	const filteredItems = useMemo(() => {
		if (categoryFilter === "all") return equipmentSummary;
		return equipmentSummary.filter((item) => item.category === categoryFilter);
	}, [equipmentSummary, categoryFilter]);

	if (equipmentSummary.length === 0) {
		return (
			<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-xs text-center">
				<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#f4f7f2] text-[#4a5e51]">
					<Package className="size-6 text-[#164027]" />
				</div>
				<h3 className="mt-3 text-sm font-extrabold text-[#10221b]">
					Chưa có thiết bị nào cần chuẩn bị
				</h3>
			</div>
		);
	}

	return (
		<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-xs">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<button
					type="button"
					onClick={() => setIsExpanded((prev) => !prev)}
					aria-expanded={isExpanded}
					className="group flex items-center gap-2 text-left"
				>
					<Package className="size-5 text-[#164027]" />
					<h3 className="text-base font-extrabold text-[#10221b] transition-colors group-hover:text-[#164027]">
						Thiết bị camper thuê cần chuẩn bị
					</h3>
					<span className="rounded-lg p-1 text-[#667a6d] transition-colors group-hover:bg-[#edf5ee] group-hover:text-[#164027]">
						{isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
					</span>
				</button>

				<div className="flex flex-wrap items-center gap-3">
					<div className="flex items-center gap-2 rounded-2xl bg-[#edf5ee] px-3.5 py-2">
						<Sparkles className="size-4 text-[#164027]" />
						<span className="text-xs font-medium text-[#4a5e51]">Tổng thiết bị:</span>
						<strong className="text-sm font-extrabold text-[#164027]">{totalPieces} món</strong>
					</div>

					{missingItemsCount > 0 ? (
						<div className="flex items-center gap-2 rounded-2xl bg-amber-50 px-3.5 py-2 ring-1 ring-amber-200">
							<AlertTriangle className="size-4 text-amber-600" />
							<span className="text-xs font-bold text-amber-800">
								{missingItemsCount} món thiếu kho
							</span>
						</div>
					) : (
						<div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3.5 py-2 ring-1 ring-emerald-200">
							<CheckCircle2 className="size-4 text-emerald-600" />
							<span className="text-xs font-bold text-emerald-800">Đủ hàng trong kho</span>
						</div>
					)}
				</div>
			</div>

			{isExpanded && (
				<>
					{/* Category Filter Tabs */}
					{categories.length > 1 && (
						<div className="mt-5 flex flex-wrap gap-2">
							<button
								type="button"
								onClick={() => setCategoryFilter("all")}
								className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
									categoryFilter === "all"
										? "bg-[#164027] text-white shadow-xs"
										: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]"
								}`}
							>
								Tất cả ({equipmentSummary.length})
							</button>
							{categories.map((cat) => {
								const count = equipmentSummary.filter((i) => i.category === cat).length;
								const isSelected = categoryFilter === cat;
								return (
									<button
										key={cat}
										type="button"
										onClick={() => setCategoryFilter(cat)}
										className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
											isSelected
												? "bg-[#164027] text-white shadow-xs"
												: "bg-[#f4f7f2] text-[#55685a] hover:bg-[#e7eee7]"
										}`}
									>
										{formatEquipmentCategory(cat)} ({count})
									</button>
								);
							})}
						</div>
					)}

					{/* Equipment Cards Grid */}
					<div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
						{filteredItems.map((item) => {
							const isSufficient = item.inventoryQuantity >= item.totalQuantity;
							const shortage = item.totalQuantity - item.inventoryQuantity;

							return (
								<div
									key={item.equipmentCatalogItemId}
									className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-[#f8faf8] p-4 transition-all hover:border-[#cbd9cd] hover:bg-white"
								>
									<div>
										<div className="flex items-start justify-between gap-2">
											<h4 className="text-sm font-extrabold text-[#10221b]">{item.name}</h4>
											<span className="shrink-0 rounded-full bg-[#dfe8df] px-2.5 py-0.5 text-[10px] font-bold text-[#4a5e51]">
												{formatEquipmentCategory(item.category)}
											</span>
										</div>

										<div className="mt-3 space-y-1.5 text-xs text-[#55685a]">
											<div className="flex items-center justify-between">
												<span>Số lượng camper thuê:</span>
												<strong className="text-sm font-extrabold text-[#164027]">
													{item.totalQuantity} chiếc
												</strong>
											</div>
											<div className="flex items-center justify-between text-[11px] text-[#667a6d]">
												<span>Kho hiện có:</span>
												<span className="font-semibold text-[#10221b]">
													{item.inventoryQuantity} chiếc
												</span>
											</div>
											<div className="flex items-center justify-between text-[11px] text-[#667a6d]">
												<span>Số đơn đặt chỗ:</span>
												<span className="font-semibold text-[#10221b]">
													{item.bookingCount} đơn
												</span>
											</div>
										</div>
									</div>

									<div className="mt-3.5 pt-3 border-t border-[#e7eee7]">
										{isSufficient ? (
											<span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
												<CheckCircle2 className="size-3.5" />
												Đủ số lượng trong kho
											</span>
										) : (
											<span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700">
												<AlertTriangle className="size-3.5" />
												Thiếu {shortage} chiếc (Cần bổ sung)
											</span>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</>
			)}
		</div>
	);
}
