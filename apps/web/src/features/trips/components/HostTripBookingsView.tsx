import { AlertCircle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { bookingCompletionService } from "../../booking-completion/services/booking-completion.service";
import { useTripBookings } from "../hooks/useTripBookings";
import type { TripStatus } from "../types";
import { HostTripBookingsList } from "./HostTripBookingsList";
import { HostTripEquipmentPreparation } from "./HostTripEquipmentPreparation";

export interface HostTripBookingsViewProps {
	tripId: string;
	tripStatus: TripStatus;
}

export function HostTripBookingsView({ tripId, tripStatus }: HostTripBookingsViewProps) {
	const { bookings, equipmentSummary, isLoading, error, refetch } = useTripBookings(tripId);
	const [completingId, setCompletingId] = useState<string | null>(null);
	const [actionMessage, setActionMessage] = useState<{
		type: "success" | "error";
		text: string;
	} | null>(null);

	const handleCompleteBooking = async (bookingId: string) => {
		setCompletingId(bookingId);
		setActionMessage(null);
		try {
			await bookingCompletionService.completeBooking(bookingId);
			setActionMessage({
				type: "success",
				text: "Đã hoàn thành đơn đặt chỗ thành công.",
			});
			await refetch();
		} catch (_err) {
			setActionMessage({
				type: "error",
				text: "Không thể hoàn thành đơn đặt chỗ. Vui lòng thử lại.",
			});
		} finally {
			setCompletingId(null);
		}
	};

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center rounded-3xl border border-[#dfe8df] bg-white py-16 text-[#667a6d]">
				<Loader2 className="size-8 animate-spin text-[#164027]" />
				<p className="mt-3 text-sm font-semibold">Đang tải danh sách đặt chỗ & thiết bị...</p>
			</div>
		);
	}

	if (error) {
		return (
			<div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-6 text-center">
				<AlertCircle className="mx-auto size-8 text-rose-600" />
				<h4 className="mt-2 text-sm font-bold text-rose-900">
					Không thể tải thông tin đặt chỗ & thiết bị
				</h4>
				<p className="mt-1 text-xs text-rose-700">{error}</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void refetch()}
					className="mt-4 gap-1.5 border-rose-200 bg-white text-rose-800 hover:bg-rose-50"
				>
					<RefreshCw className="size-3.5" />
					<span>Thử lại</span>
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Action Message Alert */}
			{actionMessage && (
				<div
					className={`flex items-center gap-2 rounded-2xl p-4 text-xs font-bold ${
						actionMessage.type === "success"
							? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
							: "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
					}`}
				>
					{actionMessage.type === "success" ? (
						<CheckCircle className="size-4 text-emerald-600 shrink-0" />
					) : (
						<AlertCircle className="size-4 text-rose-600 shrink-0" />
					)}
					<span>{actionMessage.text}</span>
				</div>
			)}

			{/* Equipment Preparation Section */}
			<HostTripEquipmentPreparation equipmentSummary={equipmentSummary} />

			{/* Bookings List Section */}
			<HostTripBookingsList
				bookings={bookings}
				tripStatus={tripStatus}
				onCompleteBooking={handleCompleteBooking}
				isCompleting={!!completingId}
			/>
		</div>
	);
}
