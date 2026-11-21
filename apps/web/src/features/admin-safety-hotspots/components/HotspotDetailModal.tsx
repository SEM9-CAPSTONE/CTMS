import { useState } from "react";
import { Button, ConfirmModal, Modal, StatusBadge } from "../../../shared/components";
import { HAZARD_SEVERITY_OPTIONS, HOTSPOT_STATUS_LABELS, HOTSPOT_STATUS_TONES } from "../constants";
import { useHotspotDetails } from "../hooks/useHotspotDetails";
import { useHotspotEvidence } from "../hooks/useHotspotEvidence";
import { useHotspotReview } from "../hooks/useHotspotReview";
import type { HotspotEvidenceEvent, SafetyHotspot } from "../types";
import { formatDate, formatDateTime, formatTime } from "../utils/format";
import { HotspotDetailsForm } from "./HotspotDetailsForm";
import { HotspotHistoryTable } from "./HotspotHistoryTable";
import { HotspotReviewForm } from "./HotspotReviewForm";

interface Props {
	hotspot: SafetyHotspot;
	onClose: () => void;
	onDeleted: () => void;
	onReviewed: (next: SafetyHotspot) => void;
}

interface TripEvidence {
	title: string;
	startsAt: string;
	events: HotspotEvidenceEvent[];
}

/** Events arrive oldest first; keeps that order for the Trips and inside each Trip. */
function groupByTrip(events: HotspotEvidenceEvent[]): TripEvidence[] {
	const trips = new Map<string, TripEvidence>();
	for (const event of events) {
		const key = `${event.tripTitle}|${event.tripStartsAt}`;
		const trip = trips.get(key) ?? {
			title: event.tripTitle,
			startsAt: event.tripStartsAt,
			events: [],
		};
		trip.events.push(event);
		trips.set(key, trip);
	}
	return [...trips.values()];
}

const minutesBetween = (from: string, to: string) =>
	Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));

export function HotspotDetailModal({ hotspot, onClose, onDeleted, onReviewed }: Props) {
	const corrections = useHotspotEvidence(hotspot.id);
	const review = useHotspotReview(hotspot.id, onReviewed);
	const details = useHotspotDetails(hotspot.id, onReviewed, onDeleted);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const severity = HAZARD_SEVERITY_OPTIONS.find((option) => option.value === hotspot.severity);
	const reviewable = hotspot.status === "DETECTED" || hotspot.status === "UNDER_REVIEW";
	const evidenceByTrip = groupByTrip(corrections.evidence);
	const facts: Array<[string, string]> = [
		["Tuyến", hotspot.routeName],
		["Mức độ", severity?.label ?? "Chưa đánh giá"],
		["Bằng chứng", `${hotspot.eventCount} lần lệch tuyến từ ${hotspot.distinctTripCount} chuyến`],
		[
			"Khoảng thời gian",
			`${formatDate(hotspot.firstEventAt)} – ${formatDate(hotspot.lastEventAt)}`,
		],
		[
			"Vị trí",
			`${hotspot.centerLat.toFixed(5)}, ${hotspot.centerLng.toFixed(5)} (bán kính ${hotspot.radiusMeters} m)`,
		],
	];

	return (
		<Modal
			isOpen
			onClose={onClose}
			title={hotspot.name ?? "Điểm nóng an toàn"}
			size="xl"
			isCloseDisabled={details.submitting || review.submitting}
		>
			<div className="space-y-6">
				<div className="space-y-3">
					<StatusBadge tone={HOTSPOT_STATUS_TONES[hotspot.status]}>
						{HOTSPOT_STATUS_LABELS[hotspot.status]}
					</StatusBadge>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						{facts.map(([label, value]) => (
							<div key={label}>
								<dt className="text-xs font-medium tracking-wide text-[#667a6d]">{label}</dt>
								<dd className="mt-1 text-[#10221b]">{value}</dd>
							</div>
						))}
					</dl>
				</div>

				{corrections.error && (
					<div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
						<span role="alert">{corrections.error}</span>
						<Button size="sm" variant="outline" onClick={() => void corrections.reload()}>
							Thử lại
						</Button>
					</div>
				)}

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-evidence-title"
				>
					<h3 id="hotspot-evidence-title" className="text-lg font-semibold text-[#10221b]">
						Các lần lệch tuyến
					</h3>
					{evidenceByTrip.length === 0 && !corrections.loading && !corrections.error && (
						<p className="text-sm text-[#667a6d]">
							Không còn dữ liệu lệch tuyến của điểm nóng này.
						</p>
					)}
					<ul className="divide-y divide-[#e8efe7]">
						{evidenceByTrip.map((trip) => (
							<li key={`${trip.title}|${trip.startsAt}`} className="space-y-1 py-3 text-sm">
								<p className="font-semibold text-[#10221b]">
									{trip.title} · khởi hành {formatDate(trip.startsAt)}
								</p>
								<ul className="space-y-0.5 text-[#10221b]">
									{trip.events.map((event) => (
										<li key={event.id}>
											{formatDateTime(event.startedAt)} – {formatTime(event.endedAt)} · lệch{" "}
											{minutesBetween(event.startedAt, event.endedAt)} phút, xa nhất{" "}
											{event.maxDistanceMeters} m
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</section>

				{reviewable && (
					<section
						className="space-y-3 border-t border-[#e8efe7] pt-4"
						aria-labelledby="hotspot-review-title"
					>
						<h3 id="hotspot-review-title" className="text-lg font-semibold text-[#10221b]">
							Xét duyệt
						</h3>
						<HotspotReviewForm submitting={review.submitting} onReview={review.review} />
					</section>
				)}

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-details-title"
				>
					<h3 id="hotspot-details-title" className="text-lg font-semibold text-[#10221b]">
						Thông tin điểm nóng
					</h3>
					<HotspotDetailsForm
						key={hotspot.id}
						hotspot={hotspot}
						submitting={details.submitting}
						onSave={details.save}
					/>
				</section>

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-history-title"
				>
					<h3 id="hotspot-history-title" className="text-lg font-semibold text-[#10221b]">
						Lịch sử
					</h3>
					{!corrections.loading && (
						<HotspotHistoryTable reviews={review.reviews} actions={corrections.history} />
					)}
				</section>

				<div className="flex justify-end border-t border-[#e8efe7] pt-4">
					<Button
						variant="outline"
						disabled={details.submitting || review.submitting}
						onClick={() => setConfirmDelete(true)}
						className="border-rose-200 text-rose-700 hover:bg-rose-50"
					>
						Xóa điểm nóng
					</Button>
				</div>
			</div>

			<ConfirmModal
				isOpen={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				onConfirm={async () => {
					if (!(await details.remove())) setConfirmDelete(false);
				}}
				isLoading={details.submitting}
				variant="danger"
				title="Xóa điểm nóng"
				description={`Điểm nóng trên tuyến ${hotspot.routeName} và lịch sử xét duyệt của nó sẽ bị xóa vĩnh viễn, không thể khôi phục. Các lần lệch tuyến vẫn được giữ, nên lần phát hiện sau có thể tạo lại điểm này.`}
				confirmText="Xóa vĩnh viễn"
				cancelText="Quay lại"
			/>
		</Modal>
	);
}
