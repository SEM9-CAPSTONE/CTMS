import { AlertCircle, Loader2, PackagePlus, RefreshCw } from "lucide-react";
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
}: BookingEquipmentPickerProps) {
	const options = useTripEquipmentOptions(tripId);
	const addedItems = useBookingItems(bookingId);
	const addition = useAddBookingItem();
	const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
	const [quantity, setQuantity] = useState(1);
	const [totalAmount, setTotalAmount] = useState(initialTotalAmount);

	const optionsById = useMemo(
		() => new Map(options.items.map((option) => [option.id, option])),
		[options.items]
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
		<section
			aria-label="Thêm thiết bị cho chuyến đi"
			className="mt-4 rounded-2xl border border-[#dfe8df] bg-white p-4"
		>
			<h3 className="text-sm font-extrabold text-[#10221b]">Thuê thêm thiết bị cho chuyến đi</h3>

			{options.isLoading && (
				<div
					data-testid="equipment-options-loading"
					className="mt-3 flex items-center gap-2 text-xs font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin" />
					Đang tải danh sách thiết bị...
				</div>
			)}

			{options.error && !options.isLoading && (
				<div
					role="alert"
					className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
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
				<p data-testid="equipment-options-empty" className="mt-3 text-xs text-[#667a6d]">
					Host của chuyến đi này chưa có thiết bị nào cho thuê.
				</p>
			)}

			{!options.isLoading && !options.error && options.items.length > 0 && (
				<form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-3">
					<label className="text-xs font-bold text-[#34483b]">
						Thiết bị
						<select
							aria-label="Thiết bị"
							value={selectedEquipmentId}
							onChange={(event) => setSelectedEquipmentId(event.target.value)}
							disabled={addition.isSubmitting}
							className="mt-1 block w-56 rounded-xl border border-[#cbd9ce] px-3 py-2 text-sm"
						>
							<option value="">-- Chọn thiết bị --</option>
							{options.items.map((item) => (
								<option key={item.id} value={item.id}>
									{item.name} ({formatCurrency(String(item.rentalPricePerDay))}/ngày)
								</option>
							))}
						</select>
					</label>
					<label className="text-xs font-bold text-[#34483b]">
						Số lượng
						<input
							type="number"
							aria-label="Số lượng thiết bị"
							min={1}
							value={quantity}
							onChange={(event) => setQuantity(Number(event.target.value))}
							disabled={addition.isSubmitting}
							className="mt-1 block w-20 rounded-xl border border-[#cbd9ce] px-3 py-2 text-sm"
						/>
					</label>
					<button
						type="submit"
						disabled={addition.isSubmitting || !selectedEquipmentId}
						className="inline-flex items-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
					>
						{addition.isSubmitting ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<PackagePlus className="size-4" />
						)}
						{addition.isSubmitting ? "Đang thêm..." : "Thêm thiết bị"}
					</button>
				</form>
			)}

			{addition.error && (
				<div
					role="alert"
					className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700"
				>
					<AlertCircle className="mt-0.5 size-4 shrink-0" />
					{addition.error.message}
				</div>
			)}

			{addedItems.items.length > 0 && (
				<ul aria-label="Thiết bị đã thêm" className="mt-4 space-y-2">
					{addedItems.items.map((item) => (
						<li
							key={item.id}
							data-testid={`booking-item-${item.id}`}
							className="flex items-center justify-between rounded-xl bg-[#f4f7f2] px-3 py-2 text-xs"
						>
							<span className="font-bold text-[#10221b]">
								{optionsById.get(item.equipmentCatalogItemId)?.name ?? "Thiết bị"} x{item.quantity}
							</span>
							<span className="font-extrabold text-[#164027]">
								{formatCurrency(item.totalPrice)}
							</span>
						</li>
					))}
				</ul>
			)}

			<div className="mt-4 flex items-baseline justify-between rounded-xl bg-[#f4f7f2] p-3 text-sm">
				<span className="font-semibold text-[#667a6d]">Tổng cộng:</span>
				<span data-testid="booking-total-amount" className="font-extrabold text-[#164027]">
					{formatCurrency(totalAmount)}
				</span>
			</div>
		</section>
	);
}
