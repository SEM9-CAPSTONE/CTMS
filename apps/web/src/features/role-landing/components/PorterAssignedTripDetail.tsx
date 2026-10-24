import { AlertCircle, ArrowLeft, CalendarDays, Loader2, MapPin, RefreshCw } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { DeviceSyncStatusCard } from "../../device-sync";
import type { RouteCheckpoint } from "../../trekking-routes/types";
import { TripIncidentsPanel } from "../../trip-incidents";
import { CheckpointProgressCard } from "../../trips/components/CheckpointProgressCard";
import { useAssignedTripOperations } from "../../trips/hooks/useAssignedTrips";
import type { PorterTripOperations, PorterTripWaypoint } from "../../trips/types";
import {
	formatTripDay,
	formatTripSchedule,
	formatTripTime,
	groupWaypointsByDay,
	toPorterTripPhase,
} from "../utils/porter-assignment";
import { PorterTripPhaseBadge } from "./PorterTripPhaseBadge";

const RouteCheckpointMap = lazy(() =>
	import("../../trekking-routes/components/RouteCheckpointMap").then((module) => ({
		default: module.RouteCheckpointMap,
	}))
);
const ignoreLocationSelection = () => {};

type DetailTab = "schedule" | "route" | "members" | "incidents" | "device-sync";

const detailTabs: { key: DetailTab; label: string }[] = [
	{ key: "schedule", label: "Lịch trình" },
	{ key: "route", label: "Tuyến đường" },
	{ key: "members", label: "Thành viên" },
	{ key: "incidents", label: "Sự cố" },
	{ key: "device-sync", label: "Đồng bộ" },
];

const waypointTypeLabels: Record<PorterTripWaypoint["type"], string> = {
	start: "Bắt đầu hành trình",
	checkpoint: "Điểm kiểm soát",
	rest: "Nghỉ chân",
	meal: "Ăn uống",
	activity: "Hoạt động",
	overnight: "Nghỉ đêm",
	finish: "Kết thúc hành trình",
};

const checkpointTypeLabels: Record<RouteCheckpoint["type"], string> = {
	start: "Bắt đầu",
	rest: "Nghỉ chân",
	water: "Nguồn nước",
	dangerous: "Nguy hiểm",
	emergency_shelter: "Nơi trú ẩn khẩn cấp",
	finish: "Kết thúc",
};

const memberLabels: Record<PorterTripOperations["members"][number]["memberStatus"], string> = {
	registered: "Đã đăng ký",
	joined: "Đã tham gia",
	no_show: "Vắng mặt",
	left: "Đã rời đoàn",
};

function MeetingPointSummary({ trip }: { trip: PorterTripOperations }) {
	const coordinates = trip.meetingPoint?.coordinates;
	return (
		<div>
			<p className="flex items-center gap-2 text-xs font-bold text-[#667a6d]">
				<MapPin className="size-4" /> Điểm tập trung
			</p>
			<p className="mt-2 font-extrabold text-[#10221b]">
				{trip.meetingPointName ?? "Điểm tập trung theo Trip"}
			</p>
			<p className="mt-1 text-xs text-[#667a6d]">
				{trip.meetingAt
					? `Có mặt lúc ${formatTripTime(trip.meetingAt)} · ${formatTripDay(trip.meetingAt)}`
					: "Chưa có giờ tập trung"}
			</p>
			{coordinates && (
				<p className="mt-1 text-xs text-[#667a6d]">
					Tọa độ: {coordinates[1].toFixed(5)}, {coordinates[0].toFixed(5)}
				</p>
			)}
		</div>
	);
}

function ScheduleTab({ trip }: { trip: PorterTripOperations }) {
	const days = groupWaypointsByDay(trip.waypoints, trip.startsAt);
	const isMultiDay = formatTripSchedule(trip.startsAt, trip.endsAt).isMultiDay || days.length > 1;
	if (days.length === 0 && !trip.meetingAt)
		return <p className="text-sm text-[#667a6d]">Chưa có lịch trình cho chuyến đi này.</p>;
	let step = 0;
	return (
		<div className="space-y-5">
			<h2 className="font-extrabold text-[#10221b]">Lịch trình chuyến đi</h2>
			{trip.meetingAt && (
				<ScheduleItem
					index={++step}
					title={`${formatTripTime(trip.meetingAt)} – Tập trung`}
					description={`${isMultiDay ? `${formatTripDay(trip.meetingAt)} · ` : ""}Có mặt tại ${
						trip.meetingPointName ?? "điểm tập trung của Trip"
					}.`}
				/>
			)}
			{days.map((day) => (
				<section key={day.dayNumber} aria-label={`Ngày ${day.dayNumber}`} className="space-y-3">
					{isMultiDay && (
						<h3 className="flex items-center gap-2 text-sm font-extrabold text-[#2d5a27]">
							<CalendarDays className="size-4" /> Ngày {day.dayNumber}
							{day.date ? ` · ${day.date}` : ""}
						</h3>
					)}
					{day.waypoints.map((waypoint) => (
						<ScheduleItem
							key={waypoint.id}
							index={++step}
							title={`${waypoint.plannedAt ? formatTripTime(waypoint.plannedAt) : "Chưa có giờ"} – ${waypoint.name}`}
							description={[
								waypointTypeLabels[waypoint.type],
								waypoint.durationMinutes ? `${waypoint.durationMinutes} phút` : null,
							]
								.filter(Boolean)
								.join(" · ")}
						/>
					))}
				</section>
			))}
		</div>
	);
}

function ScheduleItem({
	index,
	title,
	description,
}: {
	index: number;
	title: string;
	description: string;
}) {
	return (
		<div className="flex gap-4">
			<span className="w-5 shrink-0 text-sm font-extrabold text-[#667a6d]">{index}</span>
			<div className="flex-1 border-l border-[#dfe8df] pl-4">
				<p className="font-extrabold text-[#10221b]">{title}</p>
				<p className="mt-1 text-sm text-[#627769]">{description}</p>
			</div>
		</div>
	);
}

interface RoutePoint {
	id: string;
	name: string;
	typeLabel: string;
	note: string | null;
	checkpoint: RouteCheckpoint;
}

const waypointMapTypes: Partial<Record<PorterTripWaypoint["type"], RouteCheckpoint["type"]>> = {
	start: "start",
	finish: "finish",
};

/** Trip waypoints are the points the Porter actually follows; route checkpoints are the fallback. */
function getRoutePoints(trip: PorterTripOperations, routeId: string): RoutePoint[] {
	if (trip.waypoints.length > 0)
		return [...trip.waypoints]
			.sort((a, b) => a.dayNumber - b.dayNumber || a.sequenceOrder - b.sequenceOrder)
			.map((waypoint, index) => ({
				id: waypoint.id,
				name: waypoint.name,
				typeLabel: waypointTypeLabels[waypoint.type],
				note: waypoint.plannedAt
					? `Dự kiến ${formatTripTime(waypoint.plannedAt)} · ${formatTripDay(waypoint.plannedAt)}`
					: null,
				checkpoint: {
					id: waypoint.id,
					routeId,
					name: waypoint.name,
					type: waypointMapTypes[waypoint.type] ?? "rest",
					location: waypoint.location,
					radiusMeters: 0,
					expectedArrivalOffset: 0,
					instructions: "",
					nearbyWaterOrShelter: false,
					routePosition: index,
					createdAt: "",
					updatedAt: "",
				},
			}));
	return (trip.route?.checkpoints ?? []).map((checkpoint) => ({
		id: checkpoint.id,
		name: checkpoint.name,
		typeLabel: checkpointTypeLabels[checkpoint.type] ?? checkpoint.type,
		note: checkpoint.instructions || null,
		checkpoint,
	}));
}

function RouteTab({ trip }: { trip: PorterTripOperations }) {
	const route = trip.route;
	if (!route) return <p className="text-sm text-[#667a6d]">Chưa có dữ liệu tuyến đường.</p>;
	const points = getRoutePoints(trip, route.id);
	return (
		<div className="space-y-4">
			<h2 className="font-extrabold text-[#10221b]">{route.name}</h2>
			{route.status !== "active" && (
				<output className="block rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
					Tuyến đường hiện không hoạt động. Cần xác minh với Host trước khi vận hành.
				</output>
			)}
			<div className="overflow-hidden rounded-2xl border border-[#dfe8df]">
				<Suspense fallback={<p className="p-4 text-sm">Đang tải bản đồ...</p>}>
					<RouteCheckpointMap
						geometry={route.geometry}
						checkpoints={points.map((point) => point.checkpoint)}
						dangerZones={route.dangerZones}
						selectedLocation={trip.meetingPoint ?? undefined}
						radiusMeters={0}
						disabled
						onSelectLocation={ignoreLocationSelection}
					/>
				</Suspense>
			</div>

			<CheckpointProgressCard tripId={trip.tripId} />

			<h3 className="text-sm font-extrabold text-[#10221b]">
				Các điểm trên tuyến ({points.length})
			</h3>
			{points.length === 0 ? (
				<p className="text-sm text-[#667a6d]">Chưa có điểm tuyến được ghi nhận.</p>
			) : (
				<ol className="space-y-2">
					{points.map((point, index) => (
						<li
							key={point.id}
							className="flex gap-3 rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] p-3"
						>
							<span className="w-5 shrink-0 text-sm font-extrabold text-[#667a6d]">
								{index + 1}
							</span>
							<div>
								<p className="font-bold text-[#10221b]">
									{point.name}{" "}
									<span className="text-xs font-semibold text-[#667a6d]">· {point.typeLabel}</span>
								</p>
								{point.note && <p className="mt-1 text-sm text-[#627769]">{point.note}</p>}
							</div>
						</li>
					))}
				</ol>
			)}
		</div>
	);
}

function MembersTab({ trip }: { trip: PorterTripOperations }) {
	if (trip.members.length === 0)
		return <p className="text-sm text-[#667a6d]">Chưa có thành viên thuộc danh sách vận hành.</p>;
	return (
		<div className="space-y-3">
			<h2 className="font-extrabold text-[#10221b]">Thành viên ({trip.members.length})</h2>
			<ul className="divide-y divide-[#eef3ef] rounded-2xl border border-[#e5eee7]">
				{trip.members.map((member) => (
					<li key={member.memberId} className="flex items-center justify-between gap-3 p-3">
						<span className="font-bold text-[#10221b]">{member.displayName ?? "Chưa có tên"}</span>
						<span className="text-xs font-semibold text-[#667a6d]">
							{memberLabels[member.memberStatus]}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export interface PorterAssignedTripDetailViewProps {
	operations: ReturnType<typeof useAssignedTripOperations>;
	onBack?: () => void;
}

export function PorterAssignedTripDetailView({
	operations,
	onBack,
}: PorterAssignedTripDetailViewProps) {
	const [tab, setTab] = useState<DetailTab>("schedule");
	const trip = operations.data;
	const phase = trip ? toPorterTripPhase(trip.status) : null;

	return (
		<section
			aria-label="Chi tiết chuyến đi được phân công"
			className="rounded-[28px] border border-[#dfe8df] bg-white p-6 shadow-sm"
		>
			<div className="flex items-center gap-3 text-xs font-semibold text-[#667a6d]">
				<button
					type="button"
					aria-label="Quay lại danh sách phân công"
					onClick={onBack}
					className="rounded-full p-1.5 transition hover:bg-[#eef4ef]"
				>
					<ArrowLeft className="size-4" />
				</button>
				<nav aria-label="Breadcrumb">
					<button type="button" onClick={onBack} className="hover:underline">
						Phân công
					</button>{" "}
					/ Chi tiết chuyến đi
				</nav>
			</div>

			{operations.isLoading && (
				<div className="flex items-center justify-center gap-3 py-10 text-sm font-semibold text-[#667a6d]">
					<Loader2 className="size-5 animate-spin text-[#164027]" /> Đang tải chi tiết chuyến đi...
				</div>
			)}

			{!operations.isLoading && (operations.error || (trip && !phase)) && (
				<div
					role="alert"
					className="mt-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900 sm:flex-row sm:items-center"
				>
					<AlertCircle className="size-5 shrink-0" />
					<span className="flex-1">
						{operations.error ?? "Chuyến đi này không còn hiển thị trong danh sách phân công."}
					</span>
					{operations.error && (
						<Button variant="outline" size="sm" onClick={() => void operations.refetch()}>
							Thử lại
						</Button>
					)}
				</div>
			)}

			{!operations.isLoading && trip && phase && (
				<>
					<div className="mt-4 flex items-start justify-between gap-4">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h1 className="text-2xl font-extrabold text-[#10221b]">{trip.title}</h1>
								<PorterTripPhaseBadge phase={phase} />
							</div>
							{trip.route && <p className="mt-1 text-sm text-[#667a6d]">{trip.route.name}</p>}
						</div>
						<button
							type="button"
							aria-label="Tải lại chi tiết"
							onClick={() => void operations.refetch()}
							className="rounded-full p-2 text-[#55685a] transition hover:bg-[#eef4ef]"
						>
							<RefreshCw className="size-5" />
						</button>
					</div>
					{operations.isStale && (
						<p className="mt-1 text-xs text-[#667a6d]">
							Dữ liệu tại {new Date(trip.retrievedAt).toLocaleString("vi-VN")} có thể đã thay đổi.
						</p>
					)}

					<div className="mt-6 grid gap-6 border-b border-[#e5eee7] pb-6 sm:grid-cols-2">
						<div>
							<p className="flex items-center gap-2 text-xs font-bold text-[#667a6d]">
								<CalendarDays className="size-4" /> Thời gian chuyến đi
							</p>
							<p className="mt-2 font-extrabold text-[#10221b]">
								{formatTripSchedule(trip.startsAt, trip.endsAt).date}
							</p>
							<p className="mt-1 text-xs text-[#667a6d]">
								{formatTripSchedule(trip.startsAt, trip.endsAt).hours}
							</p>
						</div>
						<MeetingPointSummary trip={trip} />
					</div>

					<div
						role="tablist"
						aria-label="Thông tin chuyến đi"
						className="mt-5 flex flex-wrap gap-2"
					>
						{detailTabs.map((item) => (
							<button
								key={item.key}
								type="button"
								role="tab"
								aria-selected={tab === item.key}
								onClick={() => setTab(item.key)}
								className={`rounded-full px-4 py-2 text-sm font-bold transition ${
									tab === item.key ? "bg-[#10221b] text-white" : "text-[#55685a] hover:bg-[#eef4ef]"
								}`}
							>
								{item.label}
							</button>
						))}
					</div>

					<div role="tabpanel" className="mt-5">
						{tab === "schedule" && <ScheduleTab trip={trip} />}
						{tab === "route" && <RouteTab trip={trip} />}
						{tab === "members" && <MembersTab trip={trip} />}
						{tab === "incidents" && (
							<TripIncidentsPanel key={trip.tripId} tripId={trip.tripId} tripStatus={trip.status} />
						)}
						{tab === "device-sync" && (
							<DeviceSyncStatusCard key={trip.tripId} tripId={trip.tripId} />
						)}
					</div>
				</>
			)}
		</section>
	);
}

export function PorterAssignedTripDetail({
	tripId,
	onBack,
}: {
	tripId: string;
	onBack?: () => void;
}) {
	const operations = useAssignedTripOperations(tripId);
	return <PorterAssignedTripDetailView operations={operations} onBack={onBack} />;
}
