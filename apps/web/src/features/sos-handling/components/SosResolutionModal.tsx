import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { toast } from "../../../shared/components/Toast";
import { type SosHandlingService, sosHandlingService } from "../services/sos-handling.service";
import type { EmergencyType, SosStatus } from "../types";

export interface SosItemSummary {
	id: string;
	tripId: string;
	tripTitle?: string | null;
	senderName?: string | null;
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

const ERROR_CODE_MESSAGES: Record<string, string> = {
	SOS_ALREADY_ACKNOWLEDGED: "Yêu cầu cứu trợ này đã được tiếp nhận xử lý trước đó",
	SOS_ALREADY_CLOSED: "Yêu cầu cứu trợ này đã được đóng hoàn tất",
	SOS_ALREADY_CANCELLED: "Yêu cầu cứu trợ này đã bị người gửi hủy bỏ",
	SOS_NOT_ACKNOWLEDGED: "Yêu cầu cứu trợ phải được tiếp nhận trước khi đóng",
	SOS_NOT_ACTIVE: "Yêu cầu cứu trợ không ở trạng thái chờ tiếp nhận",
	NOT_TRIP_HOST: "Chỉ chủ chuyến đi (Host) mới có quyền xử lý yêu cầu cứu trợ",
	TRIP_NOT_FOUND: "Không tìm thấy thông tin chuyến đi",
	SOS_NOT_FOUND: "Không tìm thấy yêu cầu cứu trợ",
	NOT_SOS_SENDER: "Chỉ người gửi mới có quyền hủy yêu cầu cứu trợ này",
};

function parseErrorMessage(e: unknown): string {
	if (typeof e === "object" && e !== null) {
		const err = e as {
			error?: string;
			message?: string;
			response?: { data?: { error?: string; message?: string } };
		};
		const code = err.response?.data?.error || err.error;
		if (code && ERROR_CODE_MESSAGES[code]) {
			return ERROR_CODE_MESSAGES[code];
		}
		const msg = err.response?.data?.message || err.message;
		if (typeof msg === "string") {
			const lower = msg.toLowerCase();
			if (lower.includes("already been acknowledged") || lower.includes("already acknowledged")) {
				return ERROR_CODE_MESSAGES.SOS_ALREADY_ACKNOWLEDGED;
			}
			if (lower.includes("already closed")) {
				return ERROR_CODE_MESSAGES.SOS_ALREADY_CLOSED;
			}
			if (lower.includes("already cancelled") || lower.includes("cancelled by sender")) {
				return ERROR_CODE_MESSAGES.SOS_ALREADY_CANCELLED;
			}
			if (lower.includes("not acknowledged") || lower.includes("must be in acknowledged")) {
				return ERROR_CODE_MESSAGES.SOS_NOT_ACKNOWLEDGED;
			}
			if (lower.includes("not authorized") || lower.includes("only the authorized host")) {
				return ERROR_CODE_MESSAGES.NOT_TRIP_HOST;
			}
			return msg;
		}
	}
	return "Không thể thực hiện thao tác";
}

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

	// Synchronize status whenever target SOS changes
	useEffect(() => {
		if (sos) {
			setStatus(sos.status);
			setResolutionNote("");
			setError(null);
		}
	}, [sos]);

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
			const msg = parseErrorMessage(e);
			setError(msg);
			toast.error(msg);
			// If already acknowledged on server, sync UI status immediately
			if (
				typeof e === "object" &&
				e !== null &&
				((e as { error?: string }).error === "SOS_ALREADY_ACKNOWLEDGED" ||
					(e as { response?: { data?: { error?: string } } }).response?.data?.error ===
						"SOS_ALREADY_ACKNOWLEDGED")
			) {
				setStatus("acknowledged");
				onUpdated?.();
			}
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
			const msg = parseErrorMessage(e);
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
					{sos.tripTitle && (
						<p>
							<span className="font-medium text-[#65756a]">Chuyến đi: </span>
							<span className="font-semibold text-[#10221b]">{sos.tripTitle}</span>
						</p>
					)}
					{sos.senderName && (
						<p>
							<span className="font-medium text-[#65756a]">Người gửi: </span>
							<span className="font-semibold text-[#10221b]">{sos.senderName}</span>
						</p>
					)}
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
						<div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200">
							<CheckCircle2 className="size-4 text-amber-700 shrink-0" />
							<span>Yêu cầu cứu trợ này đã được tiếp nhận. Nút tiếp nhận đã được vô hiệu hóa.</span>
						</div>
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
							<Button
								variant="outline"
								disabled
								className="cursor-not-allowed opacity-60 bg-[#f4f7f2] text-[#8fa096] border-[#dfe8df]"
							>
								Đã tiếp nhận
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
