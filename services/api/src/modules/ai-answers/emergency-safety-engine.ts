import policy from "./emergency-safety-policy.json";

export type EmergencyIntent =
	| "KNOWLEDGE_QUERY"
	| "PREVENTION_QUERY"
	| "ACTIVE_INCIDENT"
	| "THIRD_PARTY_INCIDENT"
	| "EMERGENCY_REQUEST"
	| "UNCERTAIN_INTENT";
export type EmergencySeverity = "NORMAL" | "WARNING" | "EMERGENCY";
export type AssessmentCompleteness = "SUFFICIENT" | "INCOMPLETE" | "AMBIGUOUS";
type AffectedPerson = "SELF" | "OTHER_PERSON" | "UNKNOWN";
type TemporalContext = "CURRENT" | "PAST" | "HYPOTHETICAL" | "UNKNOWN";
export type EmergencyAssessment = {
	intent: EmergencyIntent;
	severity: EmergencySeverity;
	completeness: AssessmentCompleteness;
	affectedPerson: AffectedPerson;
	temporalContext: TemporalContext;
	matchedSignalIds: string[];
	reasonCodes: string[];
	protocolId: string | null;
	clarificationId: string | null;
	policyVersion: string;
};

type Match = { start: number; end: number };
type Phrase = { exact: string[]; plain: string[] };
type Finding = {
	severity: EmergencySeverity;
	intent: EmergencyIntent;
	person: AffectedPerson;
	time: TemporalContext;
	signalIds: string[];
	reasons: string[];
};

function canonicalWord(word: string) {
	return word.replace(
		// biome-ignore lint/suspicious/noMisleadingCharacterClass: sort decomposed Vietnamese marks individually.
		/([a-zđ])([\u0300-\u036f]+)/gu,
		(_, letter: string, marks: string) => letter + Array.from(marks).sort().join("")
	);
}

function tokens(text: string) {
	const normalized = Array.from(text, (char) =>
		/[\u00a0-\u024f\u1e00-\u1eff\u2000-\u206f\ufb00-\ufb06\uff00-\uffef]/u.test(char)
			? char.toLowerCase().normalize("NFKD")
			: char
	)
		.join("")
		.toLowerCase();
	// biome-ignore lint/suspicious/noMisleadingCharacterClass: include decomposed tone marks in each token.
	return (normalized.match(/[a-z0-9đ\u0300-\u036f]+/gu) ?? []).map(canonicalWord);
}

function plainWord(word: string) {
	// biome-ignore lint/suspicious/noMisleadingCharacterClass: fold only configured combining marks.
	return word.replace(/[\u0300-\u036f]/gu, "").replace(/đ/gu, "d");
}

function compile(expressions: string[]): Phrase[] {
	return expressions.map((expression) => {
		const exact = tokens(expression);
		return { exact, plain: exact.map(plainWord) };
	});
}

function matchesAt(words: string[], phrase: Phrase, at: number) {
	if (at < 0 || at + phrase.exact.length > words.length) return false;
	return phrase.exact.every(
		(token, index) => token === words[at + index] || phrase.plain[index] === words[at + index]
	);
}

function find(words: string[], phrases: Phrase[]): Match[] {
	const matches: Match[] = [];
	for (let at = 0; at < words.length; at++) {
		for (const phrase of phrases) {
			if (matchesAt(words, phrase, at)) {
				matches.push({ start: at, end: at + phrase.exact.length });
			}
		}
	}
	return matches;
}

type Pattern = keyof typeof policy.patterns;
const patterns = Object.fromEntries(
	Object.entries(policy.patterns).map(([key, expressions]) => [key, compile(expressions)])
) as Record<Pattern, Phrase[]>;
const signals = policy.signals.map((signal) => ({
	...signal,
	phrases: compile(signal.expressions),
}));
const has = (words: string[], pattern: Pattern) =>
	words.some((_, index) => patterns[pattern].some((phrase) => matchesAt(words, phrase, index)));

function clauses(question: string) {
	return question.split(/[.!?;,\n。！？；，]+/u).flatMap((part) => {
		const words = tokens(part);
		const result: string[][] = [];
		let from = 0;
		for (let at = 0; at < words.length; at++) {
			const boundary = patterns.clauseBreak.find((phrase) => matchesAt(words, phrase, at));
			if (!boundary) continue;
			result.push(words.slice(from, at));
			// A transition such as "and now" carries temporal information forward.
			from = at + 1;
			at += boundary.exact.length - 1;
		}
		result.push(words.slice(from));
		return result.filter((value) => value.length > 0);
	});
}

function positive(words: string[], match: Match) {
	const before = words.slice(0, match.start);
	const after = words.slice(match.end);
	return (
		!patterns.negation.some((phrase) =>
			matchesAt(before, phrase, before.length - phrase.exact.length)
		) && !patterns.postNegation.some((phrase) => matchesAt(after, phrase, 0))
	);
}

function evaluate(words: string[]): Finding {
	const person = has(words, "other") ? "OTHER_PERSON" : has(words, "self") ? "SELF" : "UNKNOWN";
	const prevention = has(words, "prevention");
	const knowledge = has(words, "knowledge");
	const hypothetical = has(words, "hypothetical");
	const past = has(words, "past");
	const current = has(words, "current");
	const time = hypothetical
		? "HYPOTHETICAL"
		: past && !current
			? "PAST"
			: current
				? "CURRENT"
				: "UNKNOWN";
	const rescue = find(words, patterns.rescue).some((match) => positive(words, match));
	const possible = find(words, patterns.possibleIncident).filter((match) => positive(words, match));
	const reported = signals
		.map((signal) => ({
			signal,
			matches: find(words, signal.phrases).filter((match) => positive(words, match)),
		}))
		.filter(({ matches }) => matches.length > 0);
	const present = reported.map(({ signal }) => signal);
	const groundedIncident =
		(person !== "UNKNOWN" || current) && !hypothetical && !(past && !current);
	const eligibleKnowledge = prevention || knowledge || hypothetical;
	const firstIncident = Math.min(
		...possible.map(({ start }) => start),
		...reported.flatMap(({ matches }) => matches.map(({ start }) => start))
	);
	const firstLearning = Math.min(
		...find(words, [...patterns.knowledge, ...patterns.prevention]).map(({ start }) => start)
	);
	const hasPersonalReport =
		groundedIncident &&
		firstIncident !== Number.POSITIVE_INFINITY &&
		(!eligibleKnowledge || (current && (firstIncident < firstLearning || !prevention)));
	const live = !hypothetical && !(past && !current) && (!eligibleKnowledge || hasPersonalReport);
	const serious =
		live &&
		present.some(
			(signal) => signal.level === "EMERGENCY" && (hasPersonalReport || signal.implicit)
		);
	const severity =
		live && (rescue || serious)
			? "EMERGENCY"
			: live && (present.length > 0 || possible.length > 0)
				? "WARNING"
				: "NORMAL";
	const intent =
		severity === "EMERGENCY" && rescue
			? "EMERGENCY_REQUEST"
			: severity !== "NORMAL" && person === "OTHER_PERSON"
				? "THIRD_PARTY_INCIDENT"
				: severity !== "NORMAL" && (groundedIncident || serious)
					? "ACTIVE_INCIDENT"
					: prevention
						? "PREVENTION_QUERY"
						: knowledge || hypothetical
							? "KNOWLEDGE_QUERY"
							: "UNCERTAIN_INTENT";
	return {
		severity,
		intent,
		person,
		time:
			severity === "EMERGENCY" || (severity === "WARNING" && groundedIncident) ? "CURRENT" : time,
		signalIds: severity === "NORMAL" ? [] : present.map((signal) => signal.id),
		reasons: [
			severity === "EMERGENCY"
				? rescue
					? "RESCUE_REQUEST"
					: "SERIOUS_SIGNAL"
				: severity === "WARNING"
					? "POSSIBLE_INCIDENT"
					: "STANDARD_FLOW",
		],
	};
}

const rank: Record<EmergencySeverity, number> = { NORMAL: 0, WARNING: 1, EMERGENCY: 2 };

export function assessEmergency(
	question: string,
	previous?: EmergencyAssessment
): EmergencyAssessment {
	const findings = clauses(question).map(evaluate);
	const base = findings.reduce<Finding>(
		(best, item) =>
			rank[item.severity] > rank[best.severity] ||
			(item.severity === best.severity &&
				((item.intent === "EMERGENCY_REQUEST" && best.intent !== "EMERGENCY_REQUEST") ||
					(best.intent === "UNCERTAIN_INTENT" && item.intent !== "UNCERTAIN_INTENT") ||
					(best.time === "UNKNOWN" && item.time !== "UNKNOWN" && best.intent === item.intent) ||
					(best.person === "UNKNOWN" &&
						item.person !== "UNKNOWN" &&
						best.intent === item.intent &&
						best.time === item.time)))
				? item
				: best,
		{
			severity: "NORMAL",
			intent: "UNCERTAIN_INTENT",
			person: "UNKNOWN",
			time: "UNKNOWN",
			signalIds: [],
			reasons: ["STANDARD_FLOW"],
		}
	);
	const words = tokens(question);
	const resolved =
		base.severity !== "EMERGENCY" &&
		words.length > 0 &&
		patterns.resolution.some(
			(phrase) => phrase.exact.length === words.length && matchesAt(words, phrase, 0)
		);
	const active = previous && previous.severity !== "NORMAL" && !resolved ? previous : undefined;
	const keep = active && rank[active.severity] > rank[base.severity];
	const severity = keep ? active.severity : resolved ? "NORMAL" : base.severity;
	const person = keep
		? active.affectedPerson
		: base.person === "UNKNOWN" && active
			? active.affectedPerson
			: base.person;
	const time = keep ? active.temporalContext : base.time;
	const intent = keep ? active.intent : base.intent;
	const reasons = resolved
		? ["INCIDENT_CONTEXT_UPDATED"]
		: [...(keep ? [] : base.reasons), ...(active ? ["UNRESOLVED_INCIDENT"] : [])];
	const matchedSignalIds = resolved
		? []
		: [
				...new Set([
					...(active?.matchedSignalIds ?? []),
					...findings.flatMap((item) => item.signalIds),
				]),
			];
	return {
		intent,
		severity,
		completeness:
			severity === "NORMAL"
				? "SUFFICIENT"
				: severity === "WARNING"
					? time === "UNKNOWN"
						? "AMBIGUOUS"
						: "INCOMPLETE"
					: person === "UNKNOWN"
						? "INCOMPLETE"
						: "SUFFICIENT",
		affectedPerson: person,
		temporalContext: time,
		matchedSignalIds,
		reasonCodes: reasons,
		protocolId: severity === "NORMAL" ? null : policy.routes[severity],
		clarificationId:
			severity !== "WARNING" ? null : time === "UNKNOWN" ? "incident_timing" : "incident_details",
		policyVersion: policy.version,
	};
}

type LocalizedProtocol = { title: string; guidance: string[]; warnings: string[] };
type PolicyProtocol = (typeof policy.protocols)[number] & {
	locales: Record<string, LocalizedProtocol>;
};
const protocolEntries: readonly PolicyProtocol[] = policy.protocols;

export function approvedSafetyProtocol(id: string | null, locale: string) {
	const protocol = protocolEntries.find(
		(entry) => entry.id === id && entry.reviewStatus === "APPROVED"
	);
	if (!protocol?.sourceReferences.length) return null;
	const copy = protocol.locales[locale.split("-")[0]] ?? protocol.locales.vi;
	return copy ? { id: protocol.id, version: protocol.version, ...copy } : null;
}

export const emergencySafetyReleaseApproved =
	policy.review.status === "APPROVED" &&
	policy.review.sourceReferences.length > 0 &&
	typeof policy.review.reviewer === "string" &&
	Boolean(String(policy.review.reviewer).trim()) &&
	typeof policy.review.approvedAt === "string" &&
	Number.isFinite(Date.parse(policy.review.approvedAt)) &&
	Boolean(policy.review.evaluationReference) &&
	policy.outputReview.status === "APPROVED" &&
	policy.outputReview.sourceReferences.length > 0 &&
	Object.values(policy.routes).every((id) =>
		policy.languages.every((language) => approvedSafetyProtocol(id, language))
	);

export const emergencySafetyEnabled = () =>
	process.env.NODE_ENV !== "production" || emergencySafetyReleaseApproved;

export function blocksEmergencyConflictingOutput(answer: string) {
	return clauses(answer).some((words) => has(words, "unsupportedOutput"));
}

export function emergencySafetyFallback(locale: string) {
	return approvedSafetyProtocol(policy.routes.fallback, locale);
}
