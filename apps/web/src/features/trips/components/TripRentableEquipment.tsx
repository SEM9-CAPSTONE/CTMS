import { Loader2, Package, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { useTripEquipmentOptions } from "../../booking-equipment/hooks/useTripEquipmentOptions";
import { bookingEquipmentService } from "../../booking-equipment/services/booking-equipment.service";
import type { BookingAccess } from "./BookingPanel";
import { RentableEquipmentModal, type SelectedEquipmentItem } from "./RentableEquipmentModal";
import { formatVND } from "./TripCard";

export interface TripRentableEquipmentProps {
	tripId: string;
	bookingAccess?: BookingAccess;
	onSignIn?: () => void;
	bookingId?: string | null;
	selectedEquipment?: SelectedEquipmentItem[];
	onConfirmSelection?: (selected: SelectedEquipmentItem[]) => Promise<void> | void;
	onTotalAmountChange?: (newTotal: string) => void;
	defaultOpen?: boolean;
}

export function formatEquipmentCategory(category: string): string {
	switch (category.toLowerCase()) {
		case "shelter":
			return "Lều bạt";
		case "sleeping":
			return "Túi & đệm ngủ";
		case "backpack":
			return "Balo & túi";
		case "gear":
			return "Trang bị dã ngoại";
		case "lighting":
			return "Đèn & chiếu sáng";
		case "cooking":
			return "Dụng cụ nấu nướng";
		case "safety":
			return "An toàn & y tế";
		default:
			return category;
	}
}

export function TripRentableEquipment({
	tripId,
	bookingAccess = "camper",
	onSignIn,
	bookingId = null,
	selectedEquipment = [],
	onConfirmSelection,
	onTotalAmountChange,
	defaultOpen = false,
}: TripRentableEquipmentProps) {
	const isCamper = bookingAccess === "camper";
	const result = useTripEquipmentOptions(tripId, isCamper);
	const safeItems = Array.isArray(result?.items) ? result.items : [];
	const isLoading = Boolean(result?.isLoading);
	const error = result?.error ?? "";
	const retry = result?.retry ?? (() => {});

	const [isModalOpen, setIsModalOpen] = useState(defaultOpen);
	const [internalSelected, setInternalSelected] =
		useState<SelectedEquipmentItem[]>(selectedEquipment);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const effectiveSelected = selectedEquipment.length > 0 ? selectedEquipment : internalSelected;

	const totalSelectedPrice = useMemo(() => {
		return effectiveSelected.reduce(
			(sum, item) => sum + item.item.rentalPricePerDay * item.quantity,
			0
		);
	}, [effectiveSelected]);

	const totalSelectedUnits = useMemo(() => {
		return effectiveSelected.reduce((sum, item) => sum + item.quantity, 0);
	}, [effectiveSelected]);

	const handleConfirm = async (selected: SelectedEquipmentItem[]) => {
		setInternalSelected(selected);
		if (bookingId && selected.length > 0) {
			setIsSubmitting(true);
			try {
				let latestTotal: string | undefined;
				for (const sel of selected) {
					const res = await bookingEquipmentService.addBookingItem(bookingId, {
						equipmentCatalogItemId: sel.item.id,
						quantity: sel.quantity,
					});
					if (res?.booking?.totalAmount) {
						latestTotal = res.booking.totalAmount;
					}
				}
				if (latestTotal) {
					onTotalAmountChange?.(latestTotal);
				}
			} finally {
				setIsSubmitting(false);
			}
		}
		await onConfirmSelection?.(selected);
	};

	return (
		<section
			aria-label="Thiết bị có thể thuê kèm của Host"
			className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Package className="size-5 text-[#164027]" />
					<h2 className="text-lg font-extrabold text-[#10221b]">
						Thiết bị có thể thuê kèm từ Host
					</h2>
					{safeItems.length > 0 && isCamper && (
						<span
							data-testid="equipment-count-badge"
							className="rounded-full bg-[#164027]/10 px-2.5 py-0.5 text-xs font-bold text-[#164027]"
						>
							{safeItems.length} thiết bị có sẵn
						</span>
					)}
				</div>

				{isCamper && !isLoading && !error && safeItems.length > 0 && (
					<button
						type="button"
						onClick={() => setIsModalOpen(true)}
						className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
					>
						<Package className="size-4" />
						<span>
							{effectiveSelected.length > 0
								? "Chỉnh sửa thiết bị đã chọn"
								: "Xem tất cả thiết bị cho thuê"}
						</span>
					</button>
				)}
			</div>

			{bookingAccess === "anonymous" && (
				<div
					data-testid="equipment-preview-anonymous"
					className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfe0d4] bg-[#f8faf8] p-5 text-center"
				>
					<p className="text-xs font-medium text-[#4f6356]">
						Chuyến đi có sẵn các thiết bị dã ngoại (lều, túi ngủ, balo...) cho thuê từ Host. Đăng
						nhập bằng tài khoản Camper để xem bảng giá và thuê kèm khi đặt chỗ.
					</p>
					{onSignIn && (
						<button
							type="button"
							onClick={onSignIn}
							className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#11321f]"
						>
							Đăng nhập để xem thiết bị
						</button>
					)}
				</div>
			)}

			{bookingAccess === "non-camper" && (
				<div
					data-testid="equipment-preview-non-camper"
					className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900"
				>
					<ShieldAlert className="size-4 shrink-0" />
					<span>
						Danh mục thiết bị cho thuê được mở cho thành viên Camper khi thực hiện đặt chỗ chuyến
						đi.
					</span>
				</div>
			)}

			{isCamper && isLoading && (
				<div
					data-testid="equipment-preview-loading"
					className="mt-4 flex items-center gap-2 text-xs font-bold text-[#667a6d]"
				>
					<Loader2 className="size-4 animate-spin text-[#164027]" />
					Đang tải danh sách thiết bị cho thuê...
				</div>
			)}

			{isCamper && error && !isLoading && (
				<div
					role="alert"
					className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
				>
					<span>{error}</span>
					<button
						type="button"
						onClick={() => void retry()}
						className="inline-flex items-center gap-1 font-bold text-red-900 underline"
					>
						<RefreshCw className="size-3" />
						Thử lại
					</button>
				</div>
			)}

			{isCamper && !isLoading && !error && safeItems.length === 0 && (
				<p data-testid="equipment-preview-empty" className="mt-4 text-xs text-[#667a6d]">
					Host của chuyến đi này chưa có thiết bị nào cho thuê.
				</p>
			)}

			{isCamper && !isLoading && !error && effectiveSelected.length > 0 && (
				<div className="mt-3 flex items-baseline justify-between border-t border-[#edf3ed] pt-2.5 text-xs">
					<span className="text-[#667a6d]">
						Đã chọn thuê:{" "}
						<strong className="text-[#10221b]">
							{effectiveSelected.length} loại ({totalSelectedUnits} món)
						</strong>
					</span>
					<span className="text-[#667a6d]">
						Tổng tiền thuê:{" "}
						<strong className="text-sm font-extrabold text-[#164027]">
							{formatVND(totalSelectedPrice)}
						</strong>
					</span>
				</div>
			)}

			<RentableEquipmentModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				items={safeItems}
				initialSelected={effectiveSelected}
				onConfirm={handleConfirm}
				isSubmitting={isSubmitting}
				bookingId={bookingId}
			/>
		</section>
	);
}
