import { Loader2, Minus, Plus, Trash2, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import type { TripEquipmentOption } from "../../booking-equipment/types";
import { formatVND } from "./TripCard";
import { formatEquipmentCategory } from "./TripRentableEquipment";

export interface SelectedEquipmentItem {
	item: TripEquipmentOption;
	quantity: number;
}

export interface RentableEquipmentModalProps {
	isOpen: boolean;
	onClose: () => void;
	items: TripEquipmentOption[];
	initialSelected?: SelectedEquipmentItem[];
	onConfirm: (selected: SelectedEquipmentItem[]) => Promise<void> | void;
	isSubmitting?: boolean;
	bookingId?: string | null;
}

export function RentableEquipmentModal({
	isOpen,
	onClose,
	items,
	initialSelected = [],
	onConfirm,
	isSubmitting = false,
	bookingId: _bookingId = null,
}: RentableEquipmentModalProps) {
	const titleId = useId();
	const [selectedMap, setSelectedMap] = useState<Map<string, number>>(() => {
		const map = new Map<string, number>();
		for (const sel of initialSelected) {
			map.set(sel.item.id, sel.quantity);
		}
		return map;
	});

	const [activeCategory, setActiveCategory] = useState<string>("all");
	const [isConfirmStep, setIsConfirmStep] = useState(false);

	const categories = useMemo(() => {
		const set = new Set<string>();
		for (const it of items) {
			set.add(it.category.toLowerCase());
		}
		return Array.from(set);
	}, [items]);

	const filteredItems = useMemo(() => {
		if (activeCategory === "all") return items;
		return items.filter((it) => it.category.toLowerCase() === activeCategory);
	}, [items, activeCategory]);

	const selectedList = useMemo<SelectedEquipmentItem[]>(() => {
		const list: SelectedEquipmentItem[] = [];
		for (const it of items) {
			const qty = selectedMap.get(it.id);
			if (qty && qty > 0) {
				list.push({ item: it, quantity: qty });
			}
		}
		return list;
	}, [items, selectedMap]);

	const totalRentalAmount = useMemo(() => {
		return selectedList.reduce((sum, sel) => sum + sel.item.rentalPricePerDay * sel.quantity, 0);
	}, [selectedList]);

	const totalUnitsCount = useMemo(() => {
		return selectedList.reduce((sum, sel) => sum + sel.quantity, 0);
	}, [selectedList]);

	if (!isOpen) return null;

	const handleToggleItem = (item: TripEquipmentOption) => {
		setSelectedMap((prev) => {
			const next = new Map(prev);
			if (next.has(item.id)) {
				next.delete(item.id);
			} else {
				next.set(item.id, 1);
			}
			return next;
		});
	};

	const handleQuantityChange = (itemId: string, maxQty: number, delta: number) => {
		setSelectedMap((prev) => {
			const next = new Map(prev);
			const current = next.get(itemId) ?? 1;
			const updated = Math.min(Math.max(1, current + delta), maxQty);
			next.set(itemId, updated);
			return next;
		});
	};

	const handleRemoveItem = (itemId: string) => {
		setSelectedMap((prev) => {
			const next = new Map(prev);
			next.delete(itemId);
			return next;
		});
	};

	const handleFinalConfirm = async () => {
		await onConfirm(selectedList);
		setIsConfirmStep(false);
		onClose();
	};

	return (
		<div
			data-testid="rentable-equipment-modal-backdrop"
			className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/60 p-4 backdrop-blur-xs"
			onClick={(e) => {
				if (e.target === e.currentTarget && !isSubmitting) onClose();
			}}
		>
			<dialog
				open
				aria-labelledby={titleId}
				className="relative m-0 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-[#dfe8df] bg-white p-0 text-[#10221b] shadow-2xl"
			>
				{/* Modal Header */}
				<header className="flex items-center justify-between border-b border-[#dfe8df] px-6 py-4">
					<h2 id={titleId} className="text-base font-extrabold text-[#10221b]">
						{isConfirmStep
							? "Xác nhận danh sách thiết bị thuê kèm"
							: "Danh mục thiết bị cho thuê từ Host"}
					</h2>
					<button
						type="button"
						aria-label="Đóng cửa sổ"
						disabled={isSubmitting}
						onClick={onClose}
						className="rounded-xl p-1.5 text-[#667a6d] transition hover:bg-gray-100 hover:text-[#10221b] disabled:opacity-50"
					>
						<X className="size-5" />
					</button>
				</header>

				{/* Modal Body */}
				<div className="flex-1 overflow-y-auto p-6">
					{!isConfirmStep ? (
						<>
							{/* Category Filters */}
							{categories.length > 1 && (
								<div className="mb-4 flex flex-wrap gap-1.5">
									<button
										type="button"
										onClick={() => setActiveCategory("all")}
										className={`rounded-full px-3 py-1 text-xs font-bold transition ${
											activeCategory === "all"
												? "bg-[#164027] text-white"
												: "bg-[#edf3ed] text-[#4f6356] hover:bg-[#dfe8df]"
										}`}
									>
										Tất cả ({items.length})
									</button>
									{categories.map((cat) => {
										const count = items.filter((i) => i.category.toLowerCase() === cat).length;
										return (
											<button
												key={cat}
												type="button"
												onClick={() => setActiveCategory(cat)}
												className={`rounded-full px-3 py-1 text-xs font-bold transition ${
													activeCategory === cat
														? "bg-[#164027] text-white"
														: "bg-[#edf3ed] text-[#4f6356] hover:bg-[#dfe8df]"
												}`}
											>
												{formatEquipmentCategory(cat)} ({count})
											</button>
										);
									})}
								</div>
							)}

							{/* Equipment Grid */}
							<div className="grid gap-3 sm:grid-cols-2">
								{filteredItems.map((item) => {
									const isSelected = selectedMap.has(item.id);
									const currentQty = selectedMap.get(item.id) ?? 1;

									return (
										<div
											key={item.id}
											data-testid={`equipment-item-${item.id}`}
											className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
												isSelected
													? "border-[#164027] bg-[#f4f8f4] shadow-xs"
													: "border-[#dfe8df] bg-[#fcfdfc] hover:border-[#b5cebc]"
											}`}
										>
											<div>
												<div className="flex items-start justify-between gap-2">
													<label className="flex items-start gap-2.5 cursor-pointer">
														<input
															type="checkbox"
															checked={isSelected}
															onChange={() => handleToggleItem(item)}
															aria-label={`Chọn thuê ${item.name}`}
															className="mt-0.5 size-4 rounded accent-[#164027]"
														/>
														<div>
															<h4 className="text-xs font-extrabold text-[#10221b] leading-snug">
																{item.name}
															</h4>
															<span className="mt-1 inline-block rounded-md bg-[#edf3ed] px-2 py-0.5 text-[10px] font-bold text-[#445b4c]">
																{formatEquipmentCategory(item.category)}
															</span>
														</div>
													</label>
													<span className="shrink-0 text-xs font-extrabold text-[#164027]">
														{formatVND(item.rentalPricePerDay)}
														<span className="text-[10px] font-normal text-[#667a6d]"> / ngày</span>
													</span>
												</div>
											</div>

											<div className="mt-3 flex items-center justify-between border-t border-[#edf3ed] pt-2.5 text-xs">
												<span className="text-[11px] text-[#667a6d]">
													Có sẵn: <strong className="text-[#10221b]">{item.quantityTotal}</strong>
												</span>

												{isSelected ? (
													<div className="flex items-center gap-1.5">
														<span className="text-[11px] font-semibold text-[#52665b]">
															Số lượng:
														</span>
														<div className="flex items-center rounded-lg border border-[#cbd9ce] bg-white">
															<button
																type="button"
																aria-label={`Giảm số lượng ${item.name}`}
																onClick={() =>
																	handleQuantityChange(item.id, item.quantityTotal, -1)
																}
																disabled={currentQty <= 1}
																className="flex size-6 items-center justify-center text-[#164027] hover:bg-gray-100 disabled:opacity-40"
															>
																<Minus className="size-3" />
															</button>
															<span
																data-testid={`equipment-qty-${item.id}`}
																className="w-6 text-center text-xs font-extrabold text-[#10221b]"
															>
																{currentQty}
															</span>
															<button
																type="button"
																aria-label={`Tăng số lượng ${item.name}`}
																onClick={() => handleQuantityChange(item.id, item.quantityTotal, 1)}
																disabled={currentQty >= item.quantityTotal}
																className="flex size-6 items-center justify-center text-[#164027] hover:bg-gray-100 disabled:opacity-40"
															>
																<Plus className="size-3" />
															</button>
														</div>
													</div>
												) : (
													<button
														type="button"
														onClick={() => handleToggleItem(item)}
														className="rounded-lg border border-[#cbd9ce] bg-white px-2.5 py-1 text-[11px] font-bold text-[#164027] hover:bg-[#edf3ed]"
													>
														+ Chọn thuê
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</>
					) : (
						/* Confirmation Step (Modal xác nhận) */
						<div data-testid="equipment-confirm-modal-step" className="space-y-4">
							<div className="divide-y divide-[#edf3ed] rounded-2xl border border-[#dfe8df] bg-[#fcfdfc]">
								{selectedList.map((sel) => (
									<div
										key={sel.item.id}
										className="flex items-center justify-between p-3.5 text-xs"
									>
										<div>
											<p className="font-bold text-[#10221b]">{sel.item.name}</p>
											<p className="text-[11px] text-[#667a6d]">
												{formatEquipmentCategory(sel.item.category)} • Đơn giá:{" "}
												{formatVND(sel.item.rentalPricePerDay)}/ngày
											</p>
										</div>

										<div className="flex items-center gap-4 text-right">
											<span className="rounded-md bg-[#edf3ed] px-2 py-0.5 font-bold text-[#164027]">
												x{sel.quantity}
											</span>
											<span className="font-extrabold text-[#10221b] min-w-[80px]">
												{formatVND(sel.item.rentalPricePerDay * sel.quantity)}
											</span>
											<button
												type="button"
												aria-label={`Bỏ chọn ${sel.item.name}`}
												onClick={() => handleRemoveItem(sel.item.id)}
												className="text-gray-400 hover:text-rose-600 transition"
											>
												<Trash2 className="size-3.5" />
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Modal Footer with Total Amount */}
				<footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe8df] bg-[#f9fbf9] px-6 py-4">
					<div
						data-testid="equipment-modal-total-bar"
						className="flex items-baseline gap-2 text-xs"
					>
						<span className="text-[#667a6d]">
							Đã chọn: <strong className="text-[#10221b]">{selectedList.length} loại</strong> (
							{totalUnitsCount} món)
						</span>
						<span className="text-[#667a6d]">•</span>
						<span className="text-[#667a6d]">
							Tổng tiền thuê:{" "}
							<strong
								data-testid="equipment-modal-total-price"
								className="text-sm font-extrabold text-[#164027]"
							>
								<span data-testid="confirm-total-amount">{formatVND(totalRentalAmount)}</span>
							</strong>
						</span>
					</div>

					<div className="flex items-center gap-2">
						{!isConfirmStep ? (
							<>
								<button
									type="button"
									onClick={onClose}
									className="rounded-xl border border-[#cbd9ce] bg-white px-4 py-2 text-xs font-bold text-[#4f6356] transition hover:bg-gray-100"
								>
									Đóng
								</button>
								<button
									type="button"
									disabled={selectedList.length === 0}
									onClick={() => setIsConfirmStep(true)}
									className="rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									Xác nhận thuê ({formatVND(totalRentalAmount)})
								</button>
							</>
						) : (
							<>
								<button
									type="button"
									disabled={isSubmitting}
									onClick={() => setIsConfirmStep(false)}
									className="rounded-xl border border-[#cbd9ce] bg-white px-4 py-2 text-xs font-bold text-[#4f6356] transition hover:bg-gray-100 disabled:opacity-50"
								>
									Quay lại
								</button>
								<button
									type="button"
									disabled={isSubmitting || selectedList.length === 0}
									onClick={handleFinalConfirm}
									className="inline-flex items-center gap-1.5 rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isSubmitting ? (
										<>
											<Loader2 className="size-3.5 animate-spin" />
											<span>Đang áp dụng...</span>
										</>
									) : (
										<span>Xác nhận & Áp dụng</span>
									)}
								</button>
							</>
						)}
					</div>
				</footer>
			</dialog>
		</div>
	);
}
