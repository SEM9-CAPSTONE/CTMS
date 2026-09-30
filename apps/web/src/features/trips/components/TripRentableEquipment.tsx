import { Loader2, Package, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { useTripEquipmentOptions } from "../../booking-equipment/hooks/useTripEquipmentOptions";
import type { BookingAccess } from "./BookingPanel";
import { formatVND } from "./TripCard";

export interface TripRentableEquipmentProps {
	tripId: string;
	bookingAccess?: BookingAccess;
	onSignIn?: () => void;
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
}: TripRentableEquipmentProps) {
	const isCamper = bookingAccess === "camper";
	const result = useTripEquipmentOptions(tripId, isCamper);
	const safeItems = Array.isArray(result?.items) ? result.items : [];
	const isLoading = Boolean(result?.isLoading);
	const error = result?.error ?? "";
	const retry = result?.retry ?? (() => {});

	return (
		<section
			aria-label="Thiết bị có thể thuê kèm của Host"
			className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="flex items-center gap-2 text-lg font-extrabold text-[#10221b]">
					<Package className="size-5 text-[#164027]" />
					<span>Thiết bị có thể thuê kèm từ Host</span>
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

			<p className="mt-1 text-xs text-[#667a6d]">
				Host cung cấp các trang thiết bị dã ngoại đạt chuẩn an toàn, bạn có thể đăng ký thuê trực
				tiếp khi đặt chỗ.
			</p>

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

			{isCamper && !isLoading && !error && safeItems.length > 0 && (
				<div className="mt-4 grid gap-3 sm:grid-cols-2">
					{safeItems.map((item) => (
						<div
							key={item.id}
							data-testid={`equipment-item-${item.id}`}
							className="flex flex-col justify-between rounded-2xl border border-[#dfe8df] bg-[#fcfdfc] p-3.5 transition hover:border-[#b4d0bc] hover:bg-[#f6faf7]"
						>
							<div>
								<div className="flex items-start justify-between gap-2">
									<h4 className="text-xs font-extrabold text-[#10221b] leading-snug">
										{item.name}
									</h4>
									<span className="shrink-0 rounded-md bg-[#edf3ed] px-2 py-0.5 text-[10px] font-bold text-[#445b4c]">
										{formatEquipmentCategory(item.category)}
									</span>
								</div>
								{item.maintenanceSchedule && (
									<p className="mt-1 line-clamp-1 text-[11px] text-[#718578] italic">
										{item.maintenanceSchedule}
									</p>
								)}
							</div>
							<div className="mt-2.5 flex items-baseline justify-between border-t border-[#edf3ed] pt-2 text-xs">
								<span className="text-[11px] text-[#667a6d]">
									Có sẵn: <strong className="text-[#10221b]">{item.quantityTotal}</strong>
								</span>
								<span className="font-extrabold text-[#164027]">
									{formatVND(item.rentalPricePerDay)}
									<span className="text-[10px] font-normal text-[#667a6d]"> / ngày</span>
								</span>
							</div>
						</div>
					))}
				</div>
			)}

			{isCamper && !isLoading && !error && safeItems.length > 0 && (
				<div className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-[#4f6356]">
					<Sparkles className="size-3.5 text-[#164027]" />
					<span>
						Bạn có thể chọn số lượng và thêm thiết bị vào đơn đặt ở khung bên phải sau khi bấm{" "}
						<strong>Đặt chỗ ngay</strong>.
					</span>
				</div>
			)}
		</section>
	);
}
