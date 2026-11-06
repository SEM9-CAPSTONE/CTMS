import { RefreshCw } from "lucide-react";
import { Button } from "../../../shared/components/Button";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import { useScheduleProgress } from "../hooks/useScheduleProgress";
import type { ScheduleProgressService } from "../services/schedule-progress.service";
import type { CamperScheduleProgress, ScheduleStatus } from "../types";

const STATUS_VIEW: Record<ScheduleStatus, { tone: StatusBadgeTone; label: string }> = {
	SEVERELY_BEHIND: { tone: "danger", label: "Chậm nghiêm trọng" },
	BEHIND: { tone: "warning", label: "Chậm hơn đoàn" },
	LOCATION_UNKNOWN: { tone: "neutral", label: "Chưa rõ vị trí" },
	ON_TRACK: { tone: "success", label: "Theo kịp đoàn" },
};

/** Most urgent first, so the Host sees who needs the Porter's on-site decision (§13.5). */
const STATUS_ORDER: ScheduleStatus[] = [
	"SEVERELY_BEHIND",
	"BEHIND",
	"LOCATION_UNKNOWN",
	"ON_TRACK",
];

function formatTime(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function MemberRow({ member }: { member: CamperScheduleProgress }) {
	const view = STATUS_VIEW[member.status];
	const warning = member.status === "BEHIND" || member.status === "SEVERELY_BEHIND";
	return (
		<li
			data-testid="schedule-progress-member"
			data-status={member.status}
			className="space-y-1.5 rounded-2xl border border-[#e7eee7] p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-bold text-[#10221b]">{member.fullName ?? "Camper"}</p>
				<StatusBadge tone={view.tone}>{view.label}</StatusBadge>
			</div>
			{member.reference && (
				<p className="text-xs text-[#627769]">
					Porter đã tới <span className="font-semibold">{member.reference.checkpointName}</span> lúc{" "}
					{formatTime(member.reference.porterArrivedAt)}
					{member.lagMinutes !== null && member.status !== "ON_TRACK"
						? ` · chậm ${member.lagMinutes} phút`
						: ""}
				</p>
			)}
			{warning && (
				<p className="text-xs text-[#10221b]">
					Điểm an toàn:{" "}
					<span className="font-semibold">
						{member.safeCheckpoint?.name ?? "Không có checkpoint an toàn gần đây"}
					</span>
				</p>
			)}
			{member.status !== "ON_TRACK" && member.guidance && (
				<p className="text-xs text-[#627769]">{member.guidance}</p>
			)}
			<p className="text-[11px] text-[#7b8c82]">
				GPS hợp lệ gần nhất: {formatTime(member.lastValidSampleAt)}
			</p>
		</li>
	);
}

/**
 * CTMS-063-T02: the Host's view of who is lagging behind the Porter. Every status, checkpoint and
 * guidance text comes from the server evaluation; nothing is derived or invented here.
 */
export function TeamScheduleProgressCard({
	tripId,
	service,
}: {
	tripId: string;
	service?: ScheduleProgressService;
}) {
	const query = useScheduleProgress(tripId, service);
	const data = query.data;

	return (
		<section
			aria-label="Tiến độ thành viên so với Porter"
			data-testid="team-schedule-progress"
			className="space-y-4 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="font-extrabold text-[#10221b]">Tiến độ thành viên so với Porter</h3>
					<p className="mt-1 text-xs text-[#627769]">
						So sánh vị trí GPS của từng Camper với checkpoint Porter đã xác nhận.
						{data
							? ` Chậm từ ${data.thresholds.behindLagMinutes} phút là cảnh báo, từ ${data.thresholds.severelyBehindLagMinutes} phút là nghiêm trọng.`
							: ""}
					</p>
				</div>
				<Button
					size="sm"
					variant="outline"
					onClick={() => void query.refetch()}
					disabled={query.isFetching}
				>
					<RefreshCw aria-hidden="true" className="mr-1 size-3.5" />
					<span>Làm mới</span>
				</Button>
			</div>

			{query.isPending && (
				<output className="block text-sm text-[#627769]">Đang tải tiến độ thành viên…</output>
			)}

			{query.isError && (
				<div
					role="alert"
					className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900"
				>
					{data
						? `Không cập nhật được tiến độ. Đang hiển thị dữ liệu lúc ${formatTime(data.evaluatedAt)}.`
						: "Không tải được tiến độ thành viên."}
				</div>
			)}

			{data && data.tripStatus !== "ongoing" && (
				<p className="text-sm text-[#627769]">Chỉ theo dõi tiến độ khi chuyến đi đang diễn ra.</p>
			)}

			{data && data.tripStatus === "ongoing" && data.members.length === 0 && (
				<p className="text-sm text-[#627769]">Chưa có Camper nào đã check-in tham gia chuyến đi.</p>
			)}

			{data && data.members.length > 0 && (
				<>
					<ul className="grid gap-3 md:grid-cols-2">
						{[...data.members]
							.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
							.map((member) => (
								<MemberRow key={member.userId} member={member} />
							))}
					</ul>
					<p className="text-[11px] text-[#7b8c82]">
						Cập nhật lúc {formatTime(data.evaluatedAt)} · tự làm mới mỗi phút
					</p>
				</>
			)}
		</section>
	);
}
