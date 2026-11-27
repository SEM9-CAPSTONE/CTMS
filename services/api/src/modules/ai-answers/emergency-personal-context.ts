import type { EmergencyAssessment } from "./emergency-safety-engine";
import {
	approvedSafetyProtocol,
	personalWarningSignals,
	safetyProtocolReference,
} from "./emergency-safety-engine";
import policy from "./emergency-safety-policy.json";

export const EMERGENCY_HEALTH_SOURCE = Symbol("EMERGENCY_HEALTH_SOURCE");

// Only a source implementing a verified, current CTMS-075 purpose grant may be registered.
// CTMS-009 trip sharing and owner self-service reads cannot serve as that grant.
export interface EmergencyHealthSource {
	authorizedForEmergencyAssessment(accountId: string): Promise<boolean>;
	// The source must enforce ownership and the current purpose grant at read time.
	// The timestamp reflects the least recent observation among the returned facts.
	readAuthorizedFacts(
		accountId: string,
		requestedCodes: readonly string[]
	): Promise<{
		accountId: string;
		observedAtMs: number;
		factCodes: readonly string[];
	} | null>;
}

export type PersonalRiskRule = {
	signalId: string;
	factCode: string;
	maxAgeSeconds: number;
	protocolId: string;
	reviewStatus: string;
	sourceReferences: readonly string[];
	reviewer: string;
	approvedAt: string;
};

const HEALTH_CONTEXT_BUDGET_MS = 150;

export async function personalizeEmergencyAssessment(
	base: EmergencyAssessment,
	question: string,
	accountId: string,
	source: EmergencyHealthSource,
	rules: readonly PersonalRiskRule[] = policy.personalRiskRules,
	now = Date.now,
	protocolEligible = (id: string) => approvedSafetyProtocol(id, "vi") !== null
): Promise<EmergencyAssessment> {
	if (base.severity !== "WARNING" || base.affectedPerson !== "SELF" || rules.length === 0)
		return base;
	const signals = personalWarningSignals(question);
	const candidates = rules.filter(
		(rule) =>
			rule.reviewStatus === "APPROVED" &&
			rule.sourceReferences.length > 0 &&
			rule.reviewer.trim() &&
			Number.isFinite(Date.parse(rule.approvedAt)) &&
			Number.isSafeInteger(rule.maxAgeSeconds) &&
			rule.maxAgeSeconds > 0 &&
			signals.has(rule.signalId) &&
			protocolEligible(rule.protocolId)
	);
	if (candidates.length === 0) return base;

	const deadline = AbortSignal.timeout(HEALTH_CONTEXT_BUDGET_MS);
	let timeout: (() => void) | undefined;
	try {
		return await Promise.race([
			new Promise<EmergencyAssessment>((resolve) => {
				timeout = () => resolve(base);
				deadline.addEventListener("abort", timeout, { once: true });
			}),
			(async (): Promise<EmergencyAssessment> => {
				if (!(await source.authorizedForEmergencyAssessment(accountId)) || deadline.aborted)
					return base;
				const facts = await source.readAuthorizedFacts(accountId, [
					...new Set(candidates.map((rule) => rule.factCode)),
				]);
				if (
					!facts ||
					facts.accountId !== accountId ||
					deadline.aborted ||
					!(await source.authorizedForEmergencyAssessment(accountId)) ||
					deadline.aborted
				)
					return base;
				const ageMs = now() - facts.observedAtMs;
				const match = candidates.find(
					(rule) =>
						Number.isFinite(ageMs) &&
						ageMs >= 0 &&
						ageMs <= rule.maxAgeSeconds * 1000 &&
						facts.factCodes.includes(rule.factCode)
				);
				return match
					? { ...base, severity: "EMERGENCY", protocolId: match.protocolId, clarificationId: null }
					: base;
			})(),
		]);
	} catch {
		// Optional context failure cannot block general guidance or enter telemetry.
		return base;
	} finally {
		if (timeout) deadline.removeEventListener("abort", timeout);
	}
}

// Keep the established safety level in the existing continuation, without
// retaining which personal protocol or profile facts influenced this turn.
export function generalEmergencyContinuation(assessment: EmergencyAssessment): EmergencyAssessment {
	return { ...assessment, protocolId: safetyProtocolReference(assessment.severity) };
}
