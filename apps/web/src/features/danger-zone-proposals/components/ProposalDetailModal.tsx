import { Modal, StatusBadge } from "../../../shared/components";
import { RouteGeometryPreview } from "../../trekking-routes/components/RouteGeometryPreview";
import type { RouteDangerZone } from "../../trekking-routes/types";
import { resolveMediaUrl } from "../../trip-incidents/utils/media-url";
import {
	HAZARD_TYPE_LABELS,
	PROPOSAL_SOURCE_LABELS,
	PROPOSAL_STATUS_LABELS,
	PROPOSAL_STATUS_TONES,
	SEVERITY_LABELS,
} from "../constants";
import { useProposalDecision } from "../hooks/useProposalDecision";
import type { DangerZoneProposal } from "../types";
import { formatDate, formatDateTime } from "../utils/proposal-errors";
import { ProposalDecisionForm } from "./ProposalDecisionForm";

interface Props {
	proposal: DangerZoneProposal;
	onClose: () => void;
	onDecided: (next: DangerZoneProposal) => void;
}

/** The proposed area drawn as an unverified zone over the Route it belongs to. */
function proposedZone(proposal: DangerZoneProposal): RouteDangerZone {
	return {
		id: `proposal:${proposal.id}`,
		routeId: proposal.routeId,
		geometry: proposal.geometry,
		radiusMeters: proposal.radiusMeters,
		description: proposal.description,
		severity: proposal.severity,
		createdAt: proposal.createdAt,
		updatedAt: proposal.createdAt,
	};
}

function locationText(proposal: DangerZoneProposal): string {
	if (proposal.geometry.type === "Polygon") return "Khu vực vẽ trên bản đồ";
	const [longitude, latitude] = proposal.geometry.coordinates;
	const accuracy =
		proposal.locationAccuracyMeters === null
			? ""
			: `, sai số GPS ${Math.round(proposal.locationAccuracyMeters)} m`;
	return `${latitude.toFixed(5)}, ${longitude.toFixed(5)} (bán kính ${proposal.radiusMeters} m${accuracy})`;
}

export function ProposalDetailModal({ proposal, onClose, onDecided }: Props) {
	const decision = useProposalDecision(proposal.id, onDecided);
	const pending = proposal.status === "PENDING";
	const reportedBy =
		proposal.tripTitle && proposal.tripStartsAt
			? `${proposal.proposerName} · chuyến ${proposal.tripTitle} khởi hành ${formatDate(proposal.tripStartsAt)}`
			: proposal.proposerName;
	const facts: Array<[string, string]> = [
		["Tuyến", proposal.routeName],
		["Nguồn", `${PROPOSAL_SOURCE_LABELS[proposal.source]} · ${reportedBy}`],
		["Thời điểm ghi nhận", formatDateTime(proposal.observedAt)],
		["Mức độ đề xuất", SEVERITY_LABELS[proposal.severity]],
		["Vị trí", locationText(proposal)],
	];
	if (proposal.reviewerName && proposal.reviewedAt) {
		facts.push([
			"Người xét duyệt",
			`${proposal.reviewerName} · ${formatDateTime(proposal.reviewedAt)}`,
		]);
	}

	return (
		<Modal
			isOpen
			onClose={onClose}
			title={HAZARD_TYPE_LABELS[proposal.hazardType]}
			size="xl"
			isCloseDisabled={decision.submitting}
		>
			<div className="space-y-6">
				<div className="space-y-3">
					<StatusBadge tone={PROPOSAL_STATUS_TONES[proposal.status]}>
						{PROPOSAL_STATUS_LABELS[proposal.status]}
					</StatusBadge>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						{facts.map(([label, value]) => (
							<div key={label}>
								<dt className="text-xs font-medium tracking-wide text-[#667a6d]">{label}</dt>
								<dd className="mt-1 text-[#10221b]">{value}</dd>
							</div>
						))}
					</dl>
					<div>
						<p className="text-xs font-medium tracking-wide text-[#667a6d]">Nội dung báo cáo</p>
						<p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#10221b]">
							{proposal.description}
						</p>
					</div>
					{proposal.photos.length > 0 && (
						<div>
							<p className="text-xs font-medium tracking-wide text-[#667a6d]">Ảnh hiện trường</p>
							<ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
								{proposal.photos.map((photo, index) => {
									const src = resolveMediaUrl(photo.url) ?? photo.url;
									return (
										<li key={photo.url}>
											<a
												href={src}
												target="_blank"
												rel="noreferrer"
												aria-label={`Mở ảnh hiện trường ${index + 1} ở kích thước gốc`}
												className="block overflow-hidden rounded-xl border border-[#dfe8df] bg-[#f6f9f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#164027]"
											>
												<img
													src={src}
													alt={`Ảnh hiện trường ${index + 1}`}
													loading="lazy"
													className="aspect-square w-full object-cover transition-opacity hover:opacity-90"
												/>
											</a>
										</li>
									);
								})}
							</ul>
						</div>
					)}
					{proposal.reviewReason && (
						<div>
							<p className="text-xs font-medium tracking-wide text-[#667a6d]">Lý do</p>
							<p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#10221b]">
								{proposal.reviewReason}
							</p>
						</div>
					)}
				</div>

				<RouteGeometryPreview
					geometry={proposal.routeGeometry}
					dangerZones={[proposedZone(proposal)]}
					variant="embedded"
					showTitle={false}
					heightClassName="h-80"
				/>

				{pending && (
					<section
						className="space-y-3 border-t border-[#e8efe7] pt-4"
						aria-labelledby="proposal-decision-title"
					>
						<h3 id="proposal-decision-title" className="text-lg font-semibold text-[#10221b]">
							Xét duyệt
						</h3>
						<ProposalDecisionForm
							proposal={proposal}
							submitting={decision.submitting}
							onApprove={decision.approve}
							onReject={decision.reject}
						/>
					</section>
				)}
			</div>
		</Modal>
	);
}
