import { Loader2 } from "lucide-react";
import { useState } from "react";
import { ConfirmModal } from "../../../shared/components/ConfirmModal";
import { ROUTE_DRAWING_MODES, type RouteDrawingMode } from "../types";

const MANUAL_NOTICE = "Các đoạn vẽ thủ công chưa được đối chiếu với dữ liệu đường đi.";
const choiceClass = "rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-40";

interface Props {
	snapping: boolean;
	setSnapping: (enabled: boolean) => void;
	disabled: boolean;
	hasManual: boolean;
	loading: boolean;
	error?: string;
	canFallback: boolean;
	canConnectToPath: boolean;
	reconnecting: boolean;
	reconnect: (mode: RouteDrawingMode) => void;
	retry: () => void;
	drawFailedSegmentManually: () => void;
	connectToPath: () => void;
	cancelEdit: () => void;
}

export function RouteDrawingControls({
	snapping,
	setSnapping,
	disabled,
	hasManual,
	loading,
	error,
	canFallback,
	canConnectToPath,
	reconnecting,
	reconnect,
	retry,
	drawFailedSegmentManually,
	connectToPath,
	cancelEdit,
}: Props) {
	const [confirmation, setConfirmation] = useState<{ warning: string; connector: boolean }>();
	const connector = confirmation?.connector === true;
	return (
		<div className="mt-3 space-y-2 text-sm">
			<label className="inline-flex cursor-pointer items-center gap-2 font-bold">
				<input
					type="checkbox"
					role="switch"
					aria-checked={snapping}
					className="size-4 accent-[#164027]"
					checked={snapping}
					disabled={disabled}
					onChange={(event) => setSnapping(event.target.checked)}
				/>
				Tự động bám đường
			</label>
			<p className="text-[#667a6d]">
				{snapping
					? "Đoạn mới sẽ bám theo đường đi bộ trên bản đồ. Hãy kiểm tra điều kiện đi lại thực tế."
					: "Đoạn mới sẽ nối thẳng từ cuối tuyến đến điểm bạn chọn."}
			</p>
			{(hasManual || !snapping) && <p className="text-amber-800">{MANUAL_NOTICE}</p>}
			{loading && (
				<output className="flex items-center gap-2">
					<Loader2 aria-hidden className="size-4 animate-spin" /> Đang tìm đường đi bộ…
				</output>
			)}
			{reconnecting && (
				<div className="space-y-2">
					<p>Chọn cách nối hai điểm còn lại sau khi xóa điểm đã chọn.</p>
					<div className="flex flex-wrap gap-2">
						<button
							type="button"
							className={choiceClass}
							disabled={disabled}
							onClick={() => reconnect(ROUTE_DRAWING_MODES.SMART)}
						>
							Nối theo đường đi bộ
						</button>
						<button
							type="button"
							className={choiceClass}
							disabled={disabled}
							onClick={() => reconnect(ROUTE_DRAWING_MODES.MANUAL)}
						>
							Nối thủ công
						</button>
						<button type="button" className={choiceClass} disabled={disabled} onClick={cancelEdit}>
							Hủy
						</button>
					</div>
				</div>
			)}
			{error && (
				<div role="alert" className="space-y-2 text-red-700">
					<p>{error} Bạn có thể chọn vị trí khác trên bản đồ.</p>
					<div className="flex flex-wrap gap-2">
						{canFallback && (
							<>
								<button type="button" className={choiceClass} disabled={disabled} onClick={retry}>
									Thử tìm đường lại
								</button>
								<button
									type="button"
									className={choiceClass}
									disabled={disabled}
									onClick={() => setConfirmation({ warning: error, connector: false })}
								>
									Vẽ thủ công đoạn này
								</button>
								{canConnectToPath && (
									<button
										type="button"
										className={choiceClass}
										disabled={disabled}
										onClick={() => setConfirmation({ warning: error, connector: true })}
									>
										Nối tới đường đi bộ
									</button>
								)}
							</>
						)}
						<button type="button" className={choiceClass} disabled={disabled} onClick={cancelEdit}>
							Bỏ thay đổi
						</button>
					</div>
				</div>
			)}
			<ConfirmModal
				isOpen={Boolean(
					canFallback &&
						confirmation &&
						confirmation.warning === error &&
						(!connector || canConnectToPath)
				)}
				onClose={() => setConfirmation(undefined)}
				onConfirm={() => {
					setConfirmation(undefined);
					if (connector) connectToPath();
					else drawFailedSegmentManually();
				}}
				title={connector ? "Nối thủ công từ cuối tuyến tới đường đi bộ?" : "Nối thủ công đoạn này?"}
				description={
					connector
						? "Đoạn nối được vẽ thẳng và chưa được đối chiếu với dữ liệu đường đi. Phần còn lại đi theo đường MapTiler tìm được."
						: MANUAL_NOTICE
				}
				confirmText="Xác nhận nối thủ công"
				variant="warning"
				isLoading={disabled}
			/>
		</div>
	);
}
