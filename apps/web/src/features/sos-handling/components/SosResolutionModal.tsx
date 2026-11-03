import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { toast } from "../../../shared/components/Toast";
import { type SosHandlingService, sosHandlingService } from "../services/sos-handling.service";
import type { EmergencyType, SosStatus } from "../types";

export interface SosItemSummary {
	id: string;
	tripId: string;
	status: SosStatus;
	emergencyType: EmergencyType;
	eventTime?: string;
}

export interface SosResolutionModalProps {
	isOpen: boolean;
	onClose: () => void;
	sos: SosItemSummary | null;
	onUpdated?: () => void;
	service?: SosHandlingService;
}

const emergencyTypeLabels: Record<EmergencyType, string> = {
	medical: "Y tế khẩn cấp",
	injury: "Chấn thương",
	lost: "Lạc đoàn",
	natural_hazard: "Thiên tai / Sạt lở",
	other: "Khẩn cấp khác",
};

const statusLabels: Record<SosStatus, string> = {
	active: "Chờ tiếp nhận",
	acknowledged: "Đã tiếp nhận (Đang hỗ trợ)",
	cancelled: "Đã hủy (Gửi nhầm)",
	closed: "Đã đóng (Xử lý xong)",
};

export function SosResolutionModal({
	isOpen,
	onClose,
	sos,
	onUpdated,
	service = sosHandlingService,
}: SosResolutionModalProps) {
	const [status, setStatus] = useState<SosStatus>(sos?.status ?? "active");
	const [resolutionNote, setResolutionNote] = useState<string>("");
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	if (!isOpen || !sos) return null;

	const handleAcknowledge = async () => {
		setIsSubmitting(true);
		setError(null);
		try {
			await service.acknowledge(sos.tripId, sos.id);
			setStatus("acknowledged");
			toast.success("Đã tiếp nhận xử lý yêu cầu SOS");
			onUpdated?.();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Không thể tiếp nhận SOS";
			setError(msg);
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = async () => {
		const note = resolutionNote.trim();
		if (!note) {
			setError("Vui lòng nhập ghi chú kết quả xử lý");
			return;
		}
		if (note.length > 500) {
			setError("Ghi chú xử lý không được vượt quá 500 ký tự");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			await service.close(sos.tripId, sos.id, note);
			setStatus("closed");
			toast.success("Đã đóng yêu cầu cứu trợ SOS thành công");
			onUpdated?.();
			onClose();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Không thể đóng SOS";
			setError(msg);
			toast.error(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const currentStatus = status ?? sos.status;

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Xử lý yêu cầu cứu trợ SOS" size="md">
			<div className="space-y-4 text-[#10221b]">
				<div className="rounded-xl bg-[#f4f7f4] p-3 text-sm space-y-1">
					<p>
						<span className="font-medium text-[#65756a]">Tình trạng: </span>
						<span className="font-semibold text-red-700">
							{emergencyTypeLabels[sos.emergencyType]}
						</span>
					</p>
					<p>
						<span className="font-medium text-[#65756a]">Trạng thái: </span>
						<span className="font-semibold">{statusLabels[currentStatus]}</span>
					</p>
				</div>

				{error && (
					<div role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
						{error}
					</div>
				)}

				{currentStatus === "active" && (
					<div className="space-y-3">
						<p className="text-sm text-[#4a5568]">
							Yêu cầu cứu trợ khẩn cấp đang chờ tiếp nhận. Vui lòng xác nhận tiếp nhận để bắt đầu xử
							lý cứu trợ.
						</p>
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
								Để sau
							</Button>
							<Button onClick={handleAcknowledge} disabled={isSubmitting}>
								{isSubmitting ? "Đang tiếp nhận..." : "Tiếp nhận SOS"}
							</Button>
						</div>
					</div>
				)}

				{currentStatus === "acknowledged" && (
					<div className="space-y-3">
						<div>
							<label htmlFor="sos-resolution-note" className="block text-sm font-medium mb-1">
								Ghi chú kết quả xử lý
							</label>
							<textarea
								id="sos-resolution-note"
								rows={4}
								className="w-full rounded-xl border border-[#dfe8df] p-2.5 text-sm outline-none focus:border-[#2f7f4f]"
								placeholder="Mô tả kết quả cứu hộ, phương án xử lý và tình trạng thành viên..."
								value={resolutionNote}
								maxLength={500}
								onChange={(e) => {
									setResolutionNote(e.target.value);
									if (error) setError(null);
								}}
								disabled={isSubmitting}
							/>
							<div className="flex justify-end text-xs text-[#65756a] mt-1">
								{resolutionNote.length}/500 ký tự
							</div>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
								Hủy
							</Button>
							<Button onClick={handleClose} disabled={isSubmitting || !resolutionNote.trim()}>
								{isSubmitting ? "Đang xử lý..." : "Đóng SOS"}
							</Button>
						</div>
					</div>
				)}

				{currentStatus === "closed" && (
					<div className="space-y-3">
						<p className="text-sm text-green-700 font-medium">
							Yêu cầu cứu trợ này đã được đóng hoàn tất và ghi nhận vào nhật ký hệ thống.
						</p>
						<div className="flex justify-end">
							<Button onClick={onClose}>Đóng</Button>
						</div>
					</div>
				)}
			</div>
		</Modal>
	);
}
