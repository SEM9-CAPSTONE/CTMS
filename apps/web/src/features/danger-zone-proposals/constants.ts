import type { StatusBadgeTone } from "../../shared/components";
import type { RouteDangerZoneSeverity } from "../trekking-routes/types";
import type {
	ProposalHazardType,
	ProposalSource,
	ProposalStatus,
	ProposalStatusFilter,
} from "./types";

export const PROPOSAL_PAGE_SIZE = 10;
export const PROPOSAL_DEFAULT_RADIUS_METERS = 30;

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
	PENDING: "Chờ duyệt",
	APPROVED: "Đã duyệt",
	REJECTED: "Đã từ chối",
};

export const PROPOSAL_STATUS_TONES: Record<ProposalStatus, StatusBadgeTone> = {
	PENDING: "warning",
	APPROVED: "success",
	REJECTED: "neutral",
};

export const PROPOSAL_STATUS_FILTERS: Array<{ value: ProposalStatusFilter; label: string }> = [
	{ value: "PENDING", label: PROPOSAL_STATUS_LABELS.PENDING },
	{ value: "APPROVED", label: PROPOSAL_STATUS_LABELS.APPROVED },
	{ value: "REJECTED", label: PROPOSAL_STATUS_LABELS.REJECTED },
	{ value: "ALL", label: "Tất cả" },
];

export const PROPOSAL_SOURCE_LABELS: Record<ProposalSource, string> = {
	HOST: "Host đề xuất",
	INCIDENT: "Báo cáo sự cố",
};

export const HAZARD_TYPE_LABELS: Record<ProposalHazardType, string> = {
	ROUTE_OBSTRUCTION: "Chướng ngại trên tuyến",
	LOST_MEMBER: "Nơi thành viên bị lạc",
	SLIPPERY_OR_LANDSLIDE: "Trơn trượt, sạt lở",
	DAMAGED_BARRIER: "Hư rào chắn",
	WILDLIFE: "Động vật hoang dã",
	OTHER: "Khác",
};

export const HAZARD_TYPE_OPTIONS = (Object.keys(HAZARD_TYPE_LABELS) as ProposalHazardType[]).map(
	(value) => ({ value, label: HAZARD_TYPE_LABELS[value] })
);

export const SEVERITY_LABELS: Record<RouteDangerZoneSeverity, string> = {
	high: "Cao",
	medium: "Trung bình",
	low: "Thấp",
};

export const SEVERITY_OPTIONS = (["high", "medium", "low"] as const).map((value) => ({
	value,
	label: SEVERITY_LABELS[value],
}));
