import { Button, Modal, StatusBadge } from "../../../shared/components";
import { HOTSPOT_STATUS_LABELS, HOTSPOT_STATUS_TONES } from "../constants";
import { useHotspotCorrections } from "../hooks/useHotspotCorrections";
import { useHotspotReview } from "../hooks/useHotspotReview";
import type { HotspotEvidenceEvent, SafetyHotspot } from "../types";
import { formatDate, formatDateTime, formatTime } from "../utils/format";
import { CorrectiveActionForm } from "./CorrectiveActionForm";
import { HotspotHistoryTable } from "./HotspotHistoryTable";
import { HotspotReviewForm } from "./HotspotReviewForm";
import { HotspotReviewTable } from "./HotspotReviewTable";

interface Props {
	hotspot: SafetyHotspot;
	onClose: () => void;
	onChanged: () => void;
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

export function HotspotDetailModal({ hotspot, onClose, onChanged, onReviewed }: Props) {
	const corrections = useHotspotCorrections(hotspot, onChanged);
	const review = useHotspotReview(hotspot.id, onReviewed);
	const confirmed = hotspot.status === "CONFIRMED";
	const reviewable = hotspot.status === "DETECTED" || hotspot.status === "UNDER_REVIEW";
	const evidenceByTrip = groupByTrip(corrections.evidence);
	const facts: Array<[string, string]> = [
		["Tuyến", hotspot.routeName],
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
			title="Điểm nóng an toàn"
			size="xl"
			isCloseDisabled={corrections.submitting || review.submitting}
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
						<HotspotReviewForm
							hotspot={hotspot}
							submitting={review.submitting}
							onReview={review.review}
						/>
					</section>
				)}

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-update-title"
				>
					<h3 id="hotspot-update-title" className="text-lg font-semibold text-[#10221b]">
						Cập nhật dữ liệu an toàn
					</h3>
					{!confirmed && (
						<p className="text-sm text-[#667a6d]">
							Điểm nóng chưa được xác nhận nên chưa thể cập nhật dữ liệu an toàn.
						</p>
					)}
					{confirmed && corrections.loading && !corrections.targets && (
						<p className="text-sm text-[#667a6d]">
							Đang tải điểm dừng và vùng nguy hiểm của tuyến...
						</p>
					)}
					{confirmed && corrections.targets && (
						<CorrectiveActionForm
							hotspot={hotspot}
							targets={corrections.targets}
							submitting={corrections.submitting}
							onSubmit={corrections.submit}
						/>
					)}
				</section>

				<section
					className="space-y-3 border-t border-[#e8efe7] pt-4"
					aria-labelledby="hotspot-history-title"
				>
					<h3 id="hotspot-history-title" className="text-lg font-semibold text-[#10221b]">
						Lịch sử
					</h3>
					<HotspotReviewTable rows={review.reviews} />
					{!corrections.loading && <HotspotHistoryTable rows={corrections.history} />}
				</section>
			</div>
		</Modal>
	);
}
