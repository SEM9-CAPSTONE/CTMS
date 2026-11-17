import {
	ConflictException,
	ForbiddenException,
	UnauthorizedException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { Review, Technical } from "./ai-investigation.types";

export const AdminAction = {
	START_REVIEW: "START_REVIEW",
	HANDOFF: "HANDOFF",
	RESOLVE: "RESOLVE",
} as const;
const issueKey = "[A-Z][A-Z0-9]{1,19}-[1-9]\\d{0,11}";
const referencePattern = new RegExp(
	`^(?:${issueKey}|https://[a-z0-9-]+\\.atlassian\\.net/browse/${issueKey}|https://github\\.com/[\\w.-]+/[\\w.-]+/(?:issues|pull)/[1-9]\\d{0,11})$`
);

export function ensureInvestigationAdmin(actor: AuthenticatedUser) {
	if (!actor || actor.status !== UserStatus.ACTIVE) throw new UnauthorizedException();
	if (!actor.roles.includes(UserRole.ADMIN)) throw new ForbiddenException();
}

export function investigationConflict(): never {
	throw new ConflictException({ code: "AI_INVESTIGATION_CONFLICT" });
}

function invalid(field: string): never {
	throw new UnprocessableEntityException({ code: "AI_INVESTIGATION_INVALID", field });
}

function required(value: unknown, field: string, max: number): string {
	if (
		typeof value !== "string" ||
		!value.trim() ||
		value.length > max ||
		value.includes("\0") ||
		/[\uD800-\uDFFF]/u.test(value)
	)
		invalid(field);
	return value.trim();
}

export function parseAdminAction(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) invalid("action");
	const body = value as Record<string, unknown>;
	const { action, version } = body;
	if (
		typeof version !== "number" ||
		!Number.isInteger(version) ||
		version < 1 ||
		version > 2147483647
	)
		invalid("version");
	if (
		action !== AdminAction.START_REVIEW &&
		action !== AdminAction.HANDOFF &&
		action !== AdminAction.RESOLVE
	)
		invalid("action");
	const keys = ["action", "version"];
	if (action !== AdminAction.START_REVIEW) keys.push("reference", "verification");
	if (action === AdminAction.RESOLVE) keys.push("disposition", "resolutionNote");
	if (Object.keys(body).some((key) => !keys.includes(key))) invalid("action");
	if (action === AdminAction.START_REVIEW) return { action, version } as const;
	const reference =
		action === AdminAction.RESOLVE && body.reference == null
			? null
			: required(body.reference, "reference", 300);
	if (reference !== null && !referencePattern.test(reference)) invalid("reference");
	const verification = required(body.verification, "verification", 2000);
	if (action === AdminAction.HANDOFF) return { action, version, reference, verification } as const;
	const { disposition } = body;
	if (disposition !== Technical.VERIFIED_FIX && disposition !== Technical.JUSTIFIED_NO_FIX)
		invalid("disposition");
	return {
		action,
		version,
		reference,
		verification,
		disposition,
		resolutionNote: required(body.resolutionNote, "resolutionNote", 2000),
	} as const;
}

export type InvestigationAction = ReturnType<typeof parseAdminAction>;

export function nextReviewState(
	current: {
		version: number;
		review_status: Review | null;
		technical_status: Technical;
		closed_at: Date | null;
	},
	command: InvestigationAction
) {
	if (current.version !== command.version || current.closed_at) investigationConflict();
	const { review_status: review, technical_status: technical } = current;
	if (command.action === AdminAction.START_REVIEW) {
		if (review !== Review.PENDING) investigationConflict();
		return { review: Review.REVIEWING, technical, close: false, recordReviewer: true };
	}
	if (review !== null && review !== Review.REVIEWING) investigationConflict();
	if (command.action === AdminAction.HANDOFF) {
		return { review, technical: Technical.HANDED_OFF, close: false, recordReviewer: false };
	}
	return {
		review: review === Review.REVIEWING ? Review.ACTIONED : null,
		technical: command.disposition,
		close: true,
		recordReviewer: review === Review.REVIEWING,
	};
}
