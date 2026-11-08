import { Megaphone, RefreshCw, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { RealtimeConnection } from "../../../core/realtime/realtimeConnection";
import { Button } from "../../../shared/components/Button";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { StatusBadge } from "../../../shared/components/StatusBadge";
import {
	EMERGENCY_ALERT_TYPE_OPTIONS,
	EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH,
	emergencyAlertTypeLabel,
	formatBroadcastTime,
} from "../constants";
import {
	listErrorMessage,
	sendErrorMessage,
	useEmergencyBroadcasts,
	useSendEmergencyBroadcast,
} from "../hooks/useEmergencyBroadcasts";
import type { EmergencyBroadcastsService } from "../services/emergency-broadcasts.service";
import type { EmergencyAlertType } from "../types";

export interface HostEmergencyBroadcastCardProps {
	tripId: string;
	service?: EmergencyBroadcastsService;
	connection?: RealtimeConnection;
}

/**
 * CTMS-081-T02: the managing Host broadcasts an emergency alert to the Trip's eligible members and
 * Porters, and sees what was already sent. Recipients are resolved by the server from the Trip;
 * there is deliberately no area or recipient picker (PB AC-6).
 */
export function HostEmergencyBroadcastCard({
	tripId,
	service,
	connection,
}: HostEmergencyBroadcastCardProps) {
	const [alertType, setAlertType] = useState<EmergencyAlertType | "">("");
	const [content, setContent] = useState("");
	const [touched, setTouched] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [sentNotice, setSentNotice] = useState<string | null>(null);
	const history = useEmergencyBroadcasts(tripId, { service, connection });
	const send = useSendEmergencyBroadcast(tripId, service);

	const trimmed = content.trim();
	const typeError = touched && !alertType ? "Chọn loại cảnh báo." : null;
	const contentError =
		touched && !trimmed
			? "Nhập nội dung cảnh báo."
			: trimmed.length > EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH
				? `Nội dung tối đa ${EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH} ký tự.`
				: null;
	const valid =
		Boolean(alertType) &&
		trimmed.length > 0 &&
		trimmed.length <= EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH;

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		setTouched(true);
		setSentNotice(null);
		if (valid) setConfirming(true);
	};

	const handleConfirm = async () => {
		if (!alertType) return;
		try {
			const created = await send.mutateAsync({ alertType, content: trimmed });
			setConfirming(false);
			setAlertType("");
			setContent("");
			setTouched(false);
			setSentNotice(
				created.recipientCount === null
					? "Đã phát cảnh báo."
					: `Đã phát cảnh báo tới ${created.recipientCount} người.`
			);
		} catch {
			setConfirming(false);
		}
	};

	const broadcasts = history.data ?? [];

	return (
		<section
			aria-label="Phát cảnh báo khẩn"
			data-testid="host-emergency-broadcast"
			className="space-y-5 rounded-3xl border border-red-200 bg-white p-6 shadow-sm"
		>
			<div className="flex items-start gap-3">
				<div className="rounded-2xl bg-red-50 p-3 text-red-600">
					<Megaphone aria-hidden="true" className="size-5" />
				</div>
				<div>
					<h3 className="font-extrabold text-[#10221b]">Phát cảnh báo khẩn</h3>
					<p className="mt-1 text-xs leading-5 text-[#627769]">
						Gửi ngay tới các thành viên đã đăng ký hoặc đã tham gia và các Porter được phân công của
						chuyến. Không gửi theo khu vực.
					</p>
				</div>
			</div>

			<form noValidate onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label htmlFor="emergency-alert-type" className="block text-xs font-bold text-[#10221b]">
						Loại cảnh báo
					</label>
					<select
						id="emergency-alert-type"
						value={alertType}
						onChange={(event) => setAlertType(event.target.value as EmergencyAlertType | "")}
						aria-invalid={Boolean(typeError)}
						className="mt-1.5 w-full rounded-2xl border border-[#dfe8df] bg-white px-4 py-2.5 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
					>
						<option value="">Chọn loại cảnh báo</option>
						{EMERGENCY_ALERT_TYPE_OPTIONS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					{typeError && <p className="mt-1 text-xs font-semibold text-red-700">{typeError}</p>}
				</div>

				<div>
					<label
						htmlFor="emergency-alert-content"
						className="block text-xs font-bold text-[#10221b]"
					>
						Nội dung và hướng dẫn
					</label>
					<textarea
						id="emergency-alert-content"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						rows={4}
						aria-invalid={Boolean(contentError)}
						placeholder="Ví dụ: Mưa lớn sắp tới, cả đoàn dừng tại điểm nghỉ gần nhất và chờ hướng dẫn."
						className="mt-1.5 w-full resize-y rounded-2xl border border-[#dfe8df] px-4 py-2.5 text-sm text-[#10221b] focus:border-[#164027] focus:outline-none"
					/>
					<div className="mt-1 flex justify-between gap-2 text-xs">
						<span className="font-semibold text-red-700">{contentError}</span>
						<span
							data-testid="emergency-content-counter"
							className={
								trimmed.length > EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH
									? "font-bold text-red-700"
									: "text-[#7b8c82]"
							}
						>
							{trimmed.length}/{EMERGENCY_BROADCAST_CONTENT_MAX_LENGTH}
						</span>
					</div>
				</div>

				{send.isError && (
					<div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800">
						{sendErrorMessage(send.error)}
					</div>
				)}
				{sentNotice && (
					<output className="block rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
						{sentNotice}
					</output>
				)}

				<div className="flex flex-wrap justify-end gap-2">
					{send.isError && (
						<Button type="button" variant="ghost" size="sm" onClick={send.startNewDraft}>
							Tạo bản nháp mới
						</Button>
					)}
					<button
						type="submit"
						disabled={send.isPending}
						className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-2.5 text-xs font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
					>
						<Send aria-hidden="true" className="size-4" />
						<span>{send.isError ? "Gửi lại" : "Phát cảnh báo"}</span>
					</button>
				</div>
			</form>

			<div className="space-y-3 border-t border-[#eef3ee] pt-4">
				<div className="flex items-center justify-between gap-2">
					<h4 className="text-sm font-extrabold text-[#10221b]">Cảnh báo đã phát</h4>
					<Button
						size="sm"
						variant="outline"
						onClick={() => void history.refetch()}
						disabled={history.isFetching}
					>
						<RefreshCw aria-hidden="true" className="mr-1 size-3.5" />
						<span>Làm mới</span>
					</Button>
				</div>
				{history.isPending && (
					<output className="block text-xs text-[#627769]">Đang tải cảnh báo đã phát…</output>
				)}
				{history.isError && (
					<div
						role="alert"
						className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900"
					>
						{listErrorMessage(history.error)}
					</div>
				)}
				{history.isSuccess && broadcasts.length === 0 && (
					<p className="text-xs text-[#627769]">Chưa phát cảnh báo nào cho chuyến này.</p>
				)}
				{broadcasts.length > 0 && (
					<ul className="space-y-2">
						{broadcasts.map((broadcast) => (
							<li
								key={broadcast.id}
								data-testid="host-emergency-broadcast-item"
								className="space-y-1.5 rounded-2xl border border-[#e7eee7] p-4"
							>
								<div className="flex flex-wrap items-center justify-between gap-2">
									<StatusBadge tone="danger">
										{emergencyAlertTypeLabel(broadcast.alertType)}
									</StatusBadge>
									<span className="text-[11px] text-[#7b8c82]">
										{formatBroadcastTime(broadcast.createdAt)}
										{broadcast.recipientCount !== null &&
											` · ${broadcast.recipientCount} người nhận`}
									</span>
								</div>
								<p className="whitespace-pre-line text-sm text-[#10221b]">{broadcast.content}</p>
							</li>
						))}
					</ul>
				)}
			</div>

			<ConfirmModal
				isOpen={confirming}
				onClose={() => setConfirming(false)}
				onConfirm={handleConfirm}
				variant="danger"
				title="Phát cảnh báo khẩn?"
				description={
					<>
						Cảnh báo <strong>{alertType ? emergencyAlertTypeLabel(alertType) : ""}</strong> sẽ được
						gửi ngay tới tất cả thành viên và Porter của chuyến. Không thể thu hồi sau khi gửi.
					</>
				}
				confirmText="Phát cảnh báo"
				cancelText="Xem lại"
				isLoading={send.isPending}
			/>
		</section>
	);
}
