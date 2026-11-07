import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { HttpError } from "../../../core/api/httpClient";
import { Button } from "../../../shared/components/Button";
import { StatusBadge, type StatusBadgeTone } from "../../../shared/components/StatusBadge";
import { useMemberLocations } from "../hooks/useMemberLocations";
import {
	currentFreshness,
	formatAgo,
	formatClock,
	formatCoordinates,
	sortMembers,
} from "../member-locations.utils";
import type { MemberLocationsService } from "../services/member-locations.service";
import type { LocationFreshness, MemberLocation } from "../types";

const FRESHNESS_VIEW: Record<LocationFreshness, { tone: StatusBadgeTone; label: string }> = {
	fresh: { tone: "success", label: "Mới" },
	stale: { tone: "warning", label: "Cũ" },
	unavailable: { tone: "neutral", label: "Chưa có dữ liệu" },
};

const BEHIND_VIEW: Record<"BEHIND" | "SEVERELY_BEHIND", { tone: StatusBadgeTone; label: string }> =
	{
		SEVERELY_BEHIND: { tone: "danger", label: "Chậm nghiêm trọng" },
		BEHIND: { tone: "warning", label: "Chậm hơn đoàn" },
	};

const CLOCK_TICK_MS = 15_000;
const systemClock = () => new Date();

/** Re-renders periodically so freshness labels follow the clock between fetches. */
function useNow(now: () => Date): Date {
	const [value, setValue] = useState(now);
	useEffect(() => {
		const timer = setInterval(() => setValue(now()), CLOCK_TICK_MS);
		return () => clearInterval(timer);
	}, [now]);
	return value;
}

function MemberRow({
	member,
	maxAgeSeconds,
	now,
}: {
	member: MemberLocation;
	maxAgeSeconds: number;
	now: Date;
}) {
	const freshness = currentFreshness(member, maxAgeSeconds, now);
	const view = FRESHNESS_VIEW[freshness];
	const behind = member.safety.behindSchedule;
	const behindView =
		behind && (behind.status === "BEHIND" || behind.status === "SEVERELY_BEHIND")
			? BEHIND_VIEW[behind.status]
			: null;
	const offRoute = member.safety.route?.type === "OFF_ROUTE";
	const gpsWeak = member.safety.gps?.type === "GPS_DEGRADED";
	const left = member.memberStatus === "left";
	const roleLabel = member.role === "porter" ? "Porter" : "Camper";
	return (
		<li
			data-testid="member-location"
			data-freshness={freshness}
			className="space-y-1.5 rounded-2xl border border-[#e7eee7] p-4"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-bold text-[#10221b]">
					{member.name ?? roleLabel}
					<span className="ml-2 text-xs font-semibold text-[#627769]">{roleLabel}</span>
				</p>
				<StatusBadge tone={view.tone}>{view.label}</StatusBadge>
			</div>
			{(left || offRoute || gpsWeak || behindView) && (
				<div className="flex flex-wrap gap-1.5">
					{left && <StatusBadge tone="neutral">Đã rời đoàn</StatusBadge>}
					{offRoute && <StatusBadge tone="danger">Lệch tuyến</StatusBadge>}
					{gpsWeak && <StatusBadge tone="warning">GPS yếu</StatusBadge>}
					{behindView && (
						<StatusBadge tone={behindView.tone}>
							{behindView.label}
							{behind?.lagMinutes != null ? ` · ${behind.lagMinutes} phút` : ""}
						</StatusBadge>
					)}
				</div>
			)}
			{member.location && member.lastSeenAt ? (
				<>
					<p className="text-xs text-[#10221b]">
						Ghi lúc <span className="font-semibold">{formatClock(member.lastSeenAt)}</span> (
						{formatAgo(member.lastSeenAt, now)})
					</p>
					<p className="text-xs text-[#627769]">{formatCoordinates(member.location)}</p>
				</>
			) : (
				<p className="text-xs text-[#627769]">
					Server chưa nhận được vị trí nào của thành viên này.
				</p>
			)}
			{member.safety.lastCheckpoint && (
				<p className="text-xs text-[#627769]">
					Checkpoint gần nhất:{" "}
					<span className="font-semibold">{member.safety.lastCheckpoint.checkpointName}</span> ·{" "}
					{formatClock(member.safety.lastCheckpoint.arrivedAt)}
				</p>
			)}
			<p className="text-[11px] text-[#7b8c82]">
				Đồng bộ gần nhất: {formatClock(member.lastSyncedAt)}
			</p>
		</li>
	);
}

function errorMessage(error: unknown, shownAt: string | null): string {
	const status = error instanceof HttpError ? error.status : null;
	if (status === 403 || status === 404) {
		return "Bạn không có quyền xem vị trí thành viên của chuyến này.";
	}
	if (status === 409) return "Chuyến đi không còn diễn ra nên không theo dõi vị trí.";
	if (shownAt) {
		return `Không cập nhật được vị trí. Đang hiển thị dữ liệu lúc ${formatClock(shownAt)}.`;
	}
	return "Không tải được vị trí thành viên.";
}

/**
 * CTMS-066-T02: each member's last server-confirmed location for the Host. Only what the server
 * returns is shown; nothing still buffered on a device is presented as known or live.
 */
export function MemberLastLocationsCard({
	tripId,
	service,
	now = systemClock,
}: {
	tripId: string;
	service?: MemberLocationsService;
	now?: () => Date;
}) {
	const query = useMemberLocations(tripId, service);
	const current = useNow(now);
	const data = query.data;
	const minutes = data ? Math.max(1, Math.round(data.freshnessMaxAgeSeconds / 60)) : null;

	return (
		<section
			aria-label="Vị trí đồng bộ gần nhất"
			data-testid="member-last-locations"
			className="space-y-4 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h3 className="font-extrabold text-[#10221b]">Vị trí đồng bộ gần nhất</h3>
					<p className="mt-1 text-xs text-[#627769]">
						Vị trí server đã nhận gần nhất, không phải vị trí trực tiếp.
						{minutes ? ` "Mới" là vị trí ghi trong ${minutes} phút gần đây.` : ""}
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
				<output className="block text-sm text-[#627769]">Đang tải vị trí thành viên…</output>
			)}

			{query.isError && (
				<div
					role="alert"
					className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900"
				>
					{errorMessage(query.error, data?.generatedAt ?? null)}
				</div>
			)}

			{data && data.members.length === 0 && (
				<p className="text-sm text-[#627769]">Chuyến đi chưa có thành viên nào để theo dõi.</p>
			)}

			{data && data.members.length > 0 && (
				<>
					<ul className="grid gap-3 md:grid-cols-2">
						{sortMembers(data.members, data.freshnessMaxAgeSeconds, current).map((member) => (
							<MemberRow
								key={`${member.role}-${member.id}`}
								member={member}
								maxAgeSeconds={data.freshnessMaxAgeSeconds}
								now={current}
							/>
						))}
					</ul>
					<p className="text-[11px] text-[#7b8c82]">
						Cập nhật lúc {formatClock(data.generatedAt)} · tự làm mới mỗi phút
					</p>
				</>
			)}
		</section>
	);
}
