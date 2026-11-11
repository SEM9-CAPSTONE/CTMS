import { Package } from "lucide-react";
import type { BookingEquipmentItemDetails } from "../types";
import { formatBookingMoney } from "../utils/booking-details-formatters";

export function BookingEquipmentSection({
	items,
}: {
	items: BookingEquipmentItemDetails[];
}) {
	return (
		<section
			aria-labelledby="booking-equipment-heading"
			className="rounded-3xl bg-white p-6 shadow-sm"
		>
			<h2 id="booking-equipment-heading" className="flex items-center gap-2 text-lg font-extrabold">
				<Package className="size-5 text-[#164027]" /> Thiết bị thuê
			</h2>
			{items.length === 0 ? (
				<p className="mt-4 text-sm text-[#667a6d]">Đơn đặt chỗ không có thiết bị thuê.</p>
			) : (
				<ul className="mt-4 space-y-3" aria-label="Danh sách thiết bị thuê">
					{items.map((item) => (
						<li key={item.id} className="rounded-2xl border border-[#dfe8df] p-4">
							<h3 className="font-bold text-[#10221b]">
								{item.presentation?.currentName ?? "Thiết bị không còn thông tin hiển thị"}
							</h3>
							<dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
								<div className="flex justify-between gap-3">
									<dt>Số lượng</dt>
									<dd className="font-bold">{item.quantity}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt>Số ngày thuê</dt>
									<dd className="font-bold">{item.rentalDays}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt>Đơn giá</dt>
									<dd className="font-bold">{formatBookingMoney(item.unitPrice)}</dd>
								</div>
								<div className="flex justify-between gap-3">
									<dt>Thành tiền</dt>
									<dd className="font-extrabold text-[#164027]">
										{formatBookingMoney(item.totalPrice)}
									</dd>
								</div>
							</dl>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
