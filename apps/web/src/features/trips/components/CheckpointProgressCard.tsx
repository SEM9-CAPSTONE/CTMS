import { CheckCircle2, Clock, Loader2, MapPin, RefreshCw, WifiOff } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../shared/components/Button";
import { useConfirmCheckpointArrival } from "../hooks/useConfirmCheckpointArrival";
import type { CheckpointProgressItem } from "../types";

export interface CheckpointProgressCardProps {
	tripId: string;
	onArrivalSuccess?: (checkpointId: string) => void;
}

export function CheckpointProgressCard({ tripId, onArrivalSuccess }: CheckpointProgressCardProps) {
	const {
		progress,
		isProgressLoading,
		progressError,
		refetchProgress,
		confirmArrival,
		isConfirming,
		pendingOfflineCount,
		syncOfflineArrivals,
		isSyncing,
		syncError,
	} = useConfirmCheckpointArrival(tripId);

	const [activeConfirmingId, setActiveConfirmingId] = useState<string | null>(null);
	const [feedbackMsg, setFeedbackMsg] = useState<{
		id: string;
		msg: string;
		isOffline?: boolean;
	} | null>(null);

	const handleConfirm = async (checkpoint: CheckpointProgressItem) => {
		setActiveConfirmingId(checkpoint.checkpointId);
		setFeedbackMsg(null);
		try {
			const res = await confirmArrival({
				checkpointId: checkpoint.checkpointId,
				checkpointName: checkpoint.name,
			});
			if (res.offline) {
				setFeedbackMsg({
					id: checkpoint.checkpointId,
					msg: "Đã lưu ngoại tuyến. Sẽ tự động đồng bộ khi có kết nối mạng.",
					isOffline: true,
				});
			} else {
				setFeedbackMsg({
					id: checkpoint.checkpointId,
					msg: "Xác nhận đến điểm thành công!",
					isOffline: false,
				});
				onArrivalSuccess?.(checkpoint.checkpointId);
			}
		} catch (error) {
			setFeedbackMsg({
				id: checkpoint.checkpointId,
				msg: error instanceof Error ? error.message : "Xác nhận thất bại.",
				isOffline: false,
			});
		} finally {
			setActiveConfirmingId(null);
		}
	};

	if (isProgressLoading) {
		return (
			<div className="flex items-center justify-center gap-2 py-6 text-sm text-[#667a6d]">
				<Loader2 className="size-4 animate-spin text-[#164027]" />
				<span>Đang tải tiến độ hành trình...</span>
			</div>
		);
	}

	if (progressError && !progress) {
		return (
			<div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
				<p>Không thể tải tiến độ hành trình.</p>
				<Button variant="outline" size="sm" onClick={() => void refetchProgress()} className="mt-2">
					Thử lại
				</Button>
			</div>
		);
	}

	if (!progress || progress.checkpoints.length === 0) {
		return null;
	}

	const { totalCheckpoints, visitedCheckpoints, progressPercentage, checkpoints } = progress;

	return (
		<div className="space-y-4">
			{/* Offline queue banner */}
			{pendingOfflineCount > 0 && (
				<output className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900 block">
					<div className="flex items-center gap-2">
						<WifiOff className="size-4 text-amber-700 shrink-0" />
						<span>
							Có <strong>{pendingOfflineCount}</strong> điểm danh đang chờ đồng bộ ngoại tuyến.
						</span>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => void syncOfflineArrivals()}
						disabled={isSyncing}
						className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100"
					>
						{isSyncing ? (
							<>
								<Loader2 className="size-3 animate-spin mr-1" /> Đang đồng bộ...
							</>
						) : (
							<>
								<RefreshCw className="size-3 mr-1" /> Đồng bộ ngay
							</>
						)}
					</Button>
				</output>
			)}

			{syncError && <p className="text-xs text-rose-600 font-medium">{syncError}</p>}

			{/* Progress overview */}
			<div className="rounded-2xl border border-[#dfe8df] bg-[#fbfdfb] p-4">
				<div className="flex items-center justify-between gap-2">
					<div>
						<p className="text-xs font-bold text-[#667a6d]">Tiến độ hành trình</p>
						<p className="text-lg font-extrabold text-[#10221b]">
							{visitedCheckpoints} / {totalCheckpoints} điểm kiểm soát
						</p>
					</div>
					<span className="rounded-full bg-[#164027]/10 px-3 py-1 text-sm font-extrabold text-[#164027]">
						{progressPercentage}%
					</span>
				</div>

				<div
					className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#e5eee7]"
					aria-label="Tiến độ hoàn thành các điểm kiểm soát"
				>
					<div
						className="h-full bg-[#164027] transition-all duration-300"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>
			</div>

			{/* Checkpoint list */}
			<div className="space-y-2">
				<h3 className="text-sm font-extrabold text-[#10221b]">
					Điểm kiểm soát & Xác nhận đến ({checkpoints.length})
				</h3>

				<ol className="space-y-2">
					{checkpoints.map((checkpoint, index) => {
						const isVisited = checkpoint.status === "arrival_confirmed";
						const isConfirmingCurrent =
							isConfirming && activeConfirmingId === checkpoint.checkpointId;
						const feedback = feedbackMsg?.id === checkpoint.checkpointId ? feedbackMsg : null;

						return (
							<li
								key={checkpoint.checkpointId}
								className={`flex flex-col gap-2 rounded-2xl border p-3 transition ${
									isVisited ? "border-[#c4e5ce] bg-[#f4fbf6]" : "border-[#e5eee7] bg-[#fbfdfb]"
								}`}
							>
								<div className="flex items-start justify-between gap-3">
									<div className="flex items-start gap-3">
										<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#eef4ef] text-xs font-extrabold text-[#667a6d]">
											{index + 1}
										</span>
										<div>
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-bold text-[#10221b]">{checkpoint.name}</p>
												{isVisited ? (
													<span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
														<CheckCircle2 className="size-3" /> Đã đến
													</span>
												) : (
													<span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
														Chưa đến
													</span>
												)}
											</div>

											{isVisited && checkpoint.arrivedAt && (
												<p className="mt-1 flex items-center gap-1 text-xs text-[#55685a]">
													<Clock className="size-3" />
													<span>
														{new Date(checkpoint.arrivedAt).toLocaleTimeString("vi-VN", {
															hour: "2-digit",
															minute: "2-digit",
														})}{" "}
														· {new Date(checkpoint.arrivedAt).toLocaleDateString("vi-VN")}
													</span>
													{checkpoint.visitedMembersCount > 0 && (
														<span className="ml-1 text-[#667a6d]">
															({checkpoint.visitedMembersCount}/{checkpoint.totalJoinedMembersCount}{" "}
															thành viên)
														</span>
													)}
												</p>
											)}
										</div>
									</div>

									{!isVisited && (
										<Button
											size="sm"
											onClick={() => void handleConfirm(checkpoint)}
											disabled={isConfirming}
											className="shrink-0 rounded-full bg-[#164027] text-white hover:bg-[#12331f] text-xs"
										>
											{isConfirmingCurrent ? (
												<>
													<Loader2 className="size-3 animate-spin mr-1" /> Đang gửi...
												</>
											) : (
												<>
													<MapPin className="size-3 mr-1" /> Xác nhận đến
												</>
											)}
										</Button>
									)}
								</div>

								{feedback && (
									<p
										className={`text-xs font-semibold pl-9 ${
											feedback.isOffline ? "text-amber-800" : "text-emerald-700"
										}`}
									>
										{feedback.msg}
									</p>
								)}
							</li>
						);
					})}
				</ol>
			</div>
		</div>
	);
}
