import { AlertCircle, Loader2, Package, PackagePlus, Plus, RefreshCw, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useAddBookingItem } from "../hooks/useAddBookingItem";
import { useBookingItems } from "../hooks/useBookingItems";
import { useTripEquipmentOptions } from "../hooks/useTripEquipmentOptions";

export interface BookingEquipmentPickerProps {
	tripId: string;
	bookingId: string;
	initialTotalAmount: string;
	onTotalAmountChange?: (newTotal: string) => void;
	onEquipmentChanged?: () => void;
	defaultOpen?: boolean;
}

function formatCurrency(value: string): string {
	const amount = Number(value);
	if (Number.isNaN(amount)) return value;
	return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export function BookingEquipmentPicker({
	tripId,
	bookingId,
	initialTotalAmount,
	onTotalAmountChange,
	onEquipmentChanged,
	defaultOpen = false,
}: BookingEquipmentPickerProps) {
	const options = useTripEquipmentOptions(tripId);
	const addedItems = useBookingItems(bookingId);
	const addition = useAddBookingItem();
	const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
	const [quantity, setQuantity] = useState(1);
	const [totalAmount, setTotalAmount] = useState(initialTotalAmount);
	const [isDialogOpen, setIsDialogOpen] = useState(defaultOpen);

	const optionsById = useMemo(
		() => new Map(options.items.map((option) => [option.id, option])),
		[options.items]
	);

	const totalItemsCount = useMemo(
		() => addedItems.items.reduce((sum, item) => sum + item.quantity, 0),
		[addedItems.items]
	);

	const equipmentRentalTotal = useMemo(
		() => addedItems.items.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0),
		[addedItems.items]
	);

	async function handleSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!selectedEquipmentId || quantity < 1) return;
		const result = await addition.submit(bookingId, {
			equipmentCatalogItemId: selectedEquipmentId,
			quantity,
		});
		if (result) {
			setTotalAmount(result.booking.totalAmount);
			onTotalAmountChange?.(result.booking.totalAmount);
			setQuantity(1);
			await addedItems.retry();
			onEquipmentChanged?.();
		}
	}

	return (
		<>
			{/* Outside compact summary */}
			<section
				aria-label="Thiết bị thuê kèm cho chuyến đi"
				className="mt-3 rounded-2xl border border-[#dfe8df] bg-[#f9fbf9] p-3 text-xs shadow-2xs"
			>
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<Package className="size-4 text-[#164027]" />
						<h3 className="font-extrabold text-[#10221b]">Thiết bị thuê kèm từ Host</h3>
					</div>
					<button
						type="button"
						onClick={() => setIsDialogOpen(true)}
						className="inline-flex items-center gap-1 rounded-xl bg-[#164027] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
					>
						<Plus className="size-3.5" />
						<span>{totalItemsCount > 0 ? "Đổi / Thuê thêm" : "Thuê thiết bị"}</span>
					</button>
				</div>

				{options.isLoading ? (
					<div
						data-testid="equipment-options-loading"
						className="mt-2.5 flex items-center gap-2 border-t border-[#edf3ed] pt-2 text-xs font-semibold text-[#667a6d]"
					>
						<Loader2 className="size-4 animate-spin text-[#164027]" />
						<span>Đang tải danh sách thiết bị...</span>
					</div>
				) : options.items.length === 0 && !options.error ? (
					<div
						data-testid="equipment-options-empty"
						className="mt-2.5 border-t border-[#edf3ed] pt-2 text-xs text-[#667a6d]"
					>
						Chuyến đi này hiện chưa có trang thiết bị cho thuê kèm từ Host.
					</div>
				) : (
					<div className="mt-2.5 flex items-baseline justify-between border-t border-[#edf3ed] pt-2 text-xs">
						<span className="text-[#667a6d]">
							Số lượng đã thuê:{" "}
							<strong className="text-[#10221b]">
								{totalItemsCount > 0 ? `${totalItemsCount} món` : "0 món"}
							</strong>
						</span>
						<span className="text-[#667a6d]">
							Tiền thuê:{" "}
							<strong className="text-sm font-extrabold text-[#164027]">
								{formatCurrency(String(equipmentRentalTotal))}
							</strong>
						</span>
					</div>
				)}

				<span data-testid="booking-total-amount" className="sr-only">
					{formatCurrency(totalAmount)}
				</span>
			</section>

			{/* Modal Popup (Dialog) */}
			{isDialogOpen && (
				<div
					data-testid="equipment-picker-dialog-backdrop"
					className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221b]/60 p-4 backdrop-blur-xs"
					onClick={(e) => {
						if (e.target === e.currentTarget) setIsDialogOpen(false);
					}}
				>
					<dialog
						open
						aria-labelledby="equipment-picker-dialog-title"
						className="relative m-0 flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl border border-[#dfe8df] bg-white p-0 text-[#10221b] shadow-2xl"
					>
						{/* Header */}
						<header className="flex items-center justify-between border-b border-[#dfe8df] px-5 py-4">
							<div className="flex items-center gap-2.5">
								<div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-[#164027] ring-1 ring-emerald-200">
									<Package className="size-5" />
								</div>
								<div>
									<h2
										id="equipment-picker-dialog-title"
										className="text-base font-extrabold text-[#10221b]"
									>
										Thuê thiết bị cho chuyến đi
									</h2>
									<p className="text-[11px] text-[#667a6d]">
										Chọn trang thiết bị dã ngoại mang theo từ Host
									</p>
								</div>
							</div>
							<button
								type="button"
								aria-label="Đóng bảng chọn thiết bị"
								onClick={() => setIsDialogOpen(false)}
								className="rounded-xl p-1.5 text-[#667a6d] transition hover:bg-gray-100 hover:text-[#10221b]"
							>
								<X className="size-5" />
							</button>
						</header>

						{/* Scrollable Body */}
						<div className="flex-1 overflow-y-auto p-5">
							{options.isLoading && (
								<div
									data-testid="equipment-options-loading"
									className="flex items-center gap-2 text-xs font-bold text-[#667a6d]"
								>
									<Loader2 className="size-4 animate-spin text-[#164027]" />
									Đang tải danh sách thiết bị...
								</div>
							)}

							{options.error && !options.isLoading && (
								<div
									role="alert"
									className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
								>
									{options.error}
									<button
										type="button"
										onClick={() => void options.retry()}
										className="ml-2 inline-flex items-center gap-1 font-bold underline"
									>
										<RefreshCw className="size-3" />
										Tải lại
									</button>
								</div>
							)}

							{!options.isLoading && !options.error && options.items.length === 0 && (
								<p data-testid="equipment-options-empty" className="text-xs text-[#667a6d]">
									Host của chuyến đi này chưa có thiết bị nào cho thuê.
								</p>
							)}

							{!options.isLoading && !options.error && options.items.length > 0 && (
								<form
									onSubmit={handleSubmit}
									className="flex flex-wrap items-end gap-3 rounded-2xl bg-[#f4f7f2] p-3.5"
								>
									<label className="flex-1 min-w-[200px] text-xs font-bold text-[#34483b]">
										Thiết bị
										<select
											aria-label="Thiết bị"
											value={selectedEquipmentId}
											onChange={(event) => setSelectedEquipmentId(event.target.value)}
											disabled={addition.isSubmitting}
											className="mt-1 block w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-xs font-medium"
										>
											<option value="">-- Chọn thiết bị --</option>
											{options.items.map((item) => (
												<option key={item.id} value={item.id}>
													{item.name} ({formatCurrency(String(item.rentalPricePerDay))}/ngày)
												</option>
											))}
										</select>
									</label>
									<label className="w-20 text-xs font-bold text-[#34483b]">
										Số lượng
										<input
											type="number"
											aria-label="Số lượng thiết bị"
											min={1}
											value={quantity}
											onChange={(event) => setQuantity(Number(event.target.value))}
											disabled={addition.isSubmitting}
											className="mt-1 block w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2 text-xs font-bold"
										/>
									</label>
									<button
										type="submit"
										disabled={addition.isSubmitting || !selectedEquipmentId}
										className="inline-flex items-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c] disabled:opacity-60"
									>
										{addition.isSubmitting ? (
											<Loader2 className="size-4 animate-spin" />
										) : (
											<PackagePlus className="size-4" />
										)}
										<span>{addition.isSubmitting ? "Đang thêm..." : "Thêm thiết bị"}</span>
									</button>
								</form>
							)}

							{addition.error && (
								<div
									role="alert"
									className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
								>
									<AlertCircle className="mt-0.5 size-4 shrink-0" />
									<span>{addition.error.message}</span>
								</div>
							)}

							{/* Added items list */}
							<div className="mt-4">
								<h4 className="text-xs font-extrabold text-[#10221b]">
									Thiết bị đã chọn ({totalItemsCount} món):
								</h4>

								{addedItems.items.length === 0 ? (
									<p className="mt-2 text-xs text-[#718578] italic">
										Chưa có thiết bị nào được chọn thuê.
									</p>
								) : (
									<ul aria-label="Thiết bị đã thêm" className="mt-2 space-y-2">
										{addedItems.items.map((item) => (
											<li
												key={item.id}
												data-testid={`booking-item-${item.id}`}
												className="flex items-center justify-between rounded-xl border border-[#dfe8df] bg-[#fbfdfb] px-3.5 py-2.5 text-xs"
											>
												<div>
													<p className="font-bold text-[#10221b]">
														{optionsById.get(item.equipmentCatalogItemId)?.name ?? "Thiết bị"}{" "}
														<span className="text-[#164027]">x{item.quantity}</span>
													</p>
													<p className="mt-0.5 text-[11px] text-[#667a6d]">
														Đơn giá: {formatCurrency(item.unitPrice)}/ngày · {item.rentalDays} ngày
													</p>
												</div>
												<span className="font-extrabold text-[#164027]">
													{formatCurrency(item.totalPrice)}
												</span>
											</li>
										))}
									</ul>
								)}
							</div>

							{/* Total summary inside modal */}
							{addedItems.items.length > 0 && (
								<div className="mt-4 rounded-xl bg-[#f4f7f2] p-3 text-xs">
									<div className="flex items-baseline justify-between font-bold">
										<span className="text-[#52665b]">Tổng tiền thuê thiết bị:</span>
										<span className="text-sm font-extrabold text-[#164027]">
											{formatCurrency(String(equipmentRentalTotal))}
										</span>
									</div>
									<p className="mt-1 text-[11px] text-[#718578] italic">
										* Tiền thuê thiết bị được tính vào tổng tiền thanh toán của đơn đặt chỗ.
									</p>
								</div>
							)}
						</div>

						{/* Footer */}
						<footer className="flex items-center justify-end border-t border-[#dfe8df] px-5 py-3">
							<button
								type="button"
								onClick={() => setIsDialogOpen(false)}
								className="rounded-xl bg-[#164027] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
							>
								Xong
							</button>
						</footer>
					</dialog>
				</div>
			)}
		</>
	);
}
