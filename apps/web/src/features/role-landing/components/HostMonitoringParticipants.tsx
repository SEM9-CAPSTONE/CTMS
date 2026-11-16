import { Clock3, MapPin, MapPinOff, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Pagination } from "../../../shared/components/Pagination";
import type { MapParticipant, ParticipantSelection } from "../types/active-trip-map";
import {
	formatTime,
	freshnessLabels,
	participantLabel,
	participantMapCode,
	participantRoleLabel,
	relativePositionTime,
} from "../utils/participant-position";
import { type ParticipantSort, sortMapParticipants } from "../utils/participant-sort";

type Participant = MapParticipant & { outsideRouteArea: boolean };
const PAGE_SIZE = 6;
const normalizeName = (value: string) =>
	value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[đĐ]/g, "d").toLocaleLowerCase("vi");

export function HostMonitoringParticipants({
	participants,
	member,
	tripId,
	now,
	onSelect,
}: {
	participants: Participant[];
	member?: MapParticipant;
	tripId: string;
	now: number;
	onSelect: (selection: ParticipantSelection) => void;
}) {
	const [page, setPage] = useState(1);
	const rosterRef = useRef<HTMLUListElement>(null);
	const [search, setSearch] = useState("");
	const [role, setRole] = useState("all");
	const [freshness, setFreshness] = useState("all");
	const [sort, setSort] = useState<ParticipantSort>("attention");
	const all = sortMapParticipants(participants, sort);
	const filtered = all.filter(
		({ participant }) =>
			(role === "all" || participant.role === role) &&
			(freshness === "all" || participant.freshness === freshness) &&
			normalizeName(participantLabel(participant)).includes(normalizeName(search.trim()))
	);
	const isSelected = (participant: MapParticipant) =>
		participant.id === member?.id && participant.role === member?.role;
	const selectedIndex = filtered.findIndex(({ participant }) => isSelected(participant));
	const selectionKey = member ? `${member.role}:${member.id}` : undefined;
	const [lastSelection, setLastSelection] = useState(selectionKey);
	if (selectionKey !== lastSelection) {
		setLastSelection(selectionKey);
		if (member && selectedIndex < 0) {
			setSearch("");
			setRole("all");
			setFreshness("all");
			setPage(
				Math.floor(all.findIndex(({ participant }) => isSelected(participant)) / PAGE_SIZE) + 1
			);
		} else if (selectedIndex >= 0) setPage(Math.floor(selectedIndex / PAGE_SIZE) + 1);
	}
	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
	const pinned = member && !visible.some(({ participant }) => isSelected(participant));
	useEffect(() => {
		if (!selectionKey) return;
		rosterRef.current
			?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
			?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
	}, [selectionKey]);
	const counts = { fresh: 0, stale: 0, unavailable: 0 };
	for (const participant of participants) counts[participant.freshness]++;
	const resetPage = () => setPage(1);
	return (
		<section aria-label="Danh sách thành viên" className="space-y-3">
			<p className="text-sm font-semibold text-slate-700">
				{participants.length} thành viên: {counts.fresh} mới, {counts.stale} cũ,{" "}
				{counts.unavailable} chưa có vị trí
			</p>
			<div className="flex flex-wrap gap-2">
				<label className="flex min-w-0 basis-full flex-1 items-center gap-2 rounded-lg border border-slate-300 px-3">
					<Search className="size-4 text-slate-500" aria-hidden="true" />
					<input
						aria-label="Tìm thành viên theo tên"
						placeholder="Tìm theo tên"
						className="min-w-0 w-full bg-transparent py-2 text-sm outline-none"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							resetPage();
						}}
					/>
				</label>
				<select
					aria-label="Lọc vai trò"
					className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
					value={role}
					onChange={(event) => {
						setRole(event.target.value);
						resetPage();
					}}
				>
					<option value="all">Mọi vai trò</option>
					<option value="camper">Người tham gia</option>
					<option value="porter">Người hỗ trợ</option>
				</select>
				<select
					aria-label="Lọc trạng thái vị trí"
					className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
					value={freshness}
					onChange={(event) => {
						setFreshness(event.target.value);
						resetPage();
					}}
				>
					<option value="all">Mọi vị trí</option>
					<option value="unavailable">Chưa có vị trí</option>
					<option value="stale">Vị trí cũ</option>
					<option value="fresh">Vị trí mới</option>
				</select>
				<label className="flex min-w-0 basis-full items-center gap-2 text-sm">
					<span>Sắp xếp</span>
					<select
						aria-label="Sắp xếp thành viên"
						value={sort}
						onChange={(event) => {
							setSort(event.target.value as ParticipantSort);
							resetPage();
						}}
						className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
					>
						<option value="attention">Cần chú ý trước</option>
						<option value="name">Họ tên A–Z</option>
						<option value="code">Mã C/P tăng dần</option>
					</select>
				</label>
			</div>
			{pinned && (
				<div className="rounded-lg border border-emerald-700 bg-emerald-50 px-3 py-2 text-sm">
					Đang chọn: {participantLabel(member)} · {participantRoleLabel(member.role)}
					<Button
						variant="ghost"
						size="sm"
						onClick={() => {
							setSearch("");
							setRole("all");
							setFreshness("all");
							setPage(
								Math.floor(
									all.findIndex(({ participant }) => isSelected(participant)) / PAGE_SIZE
								) + 1
							);
						}}
					>
						Hiện trong danh sách
					</Button>
				</div>
			)}
			<ul ref={rosterRef} aria-label="Thành viên trên bản đồ" className="min-h-[264px] space-y-1">
				{visible.map(({ participant, index }) => {
					const selected = isSelected(participant);
					const StatusIcon =
						participant.freshness === "fresh"
							? MapPin
							: participant.freshness === "stale"
								? Clock3
								: MapPinOff;
					const title = `${participantMapCode(participant.role, index)} · ${participantLabel(participant)} · ${participantRoleLabel(participant.role)}`;
					const status = participant.lastSeenAt
						? `${freshnessLabels[participant.freshness]} · ${relativePositionTime(participant.lastSeenAt, now)}`
						: freshnessLabels[participant.freshness];
					return (
						<li key={participant.role + participant.id}>
							<Button
								variant="ghost"
								aria-pressed={selected}
								title={`${title} · ${status}${participant.lastSeenAt ? ` · ${formatTime.format(new Date(participant.lastSeenAt))}` : ""}`}
								className={`flex min-h-10 h-auto w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm ${selected ? "border-emerald-800 bg-emerald-50" : "border-transparent"}`}
								onClick={() =>
									onSelect({ tripId, role: participant.role, participantId: participant.id })
								}
							>
								<span className="min-w-0 flex-1 whitespace-normal break-words text-left font-medium">
									{title}
								</span>
								<span
									className="ml-auto flex shrink-0 items-center gap-1 text-xs text-slate-600"
									aria-label={status}
								>
									<StatusIcon
										className={`size-4 ${participant.freshness === "stale" ? "text-amber-800" : ""}`}
										aria-hidden="true"
									/>
									{participant.lastSeenAt
										? relativePositionTime(participant.lastSeenAt, now)
										: "Chưa có vị trí"}
								</span>
								{participant.outsideRouteArea && (
									<span className="text-xs font-medium text-amber-900">Ngoài khu vực tuyến</span>
								)}
							</Button>
						</li>
					);
				})}
				{filtered.length === 0 && (
					<li className="py-4 text-sm text-slate-600">Không có thành viên phù hợp.</li>
				)}
			</ul>
			<Pagination
				currentPage={currentPage}
				totalPages={totalPages}
				totalItems={filtered.length}
				itemsPerPage={PAGE_SIZE}
				onPageChange={setPage}
			/>
		</section>
	);
}
