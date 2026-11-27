import type { TermsSection, TermsSubsection } from "../types";

function escapeHtml(raw: string): string {
	return raw
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function toVietnameseSlug(text: string, fallbackIndex: number): string {
	const normalized = text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.replace(/đ/gi, "d")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return normalized || `muc-${fallbackIndex}`;
}

export function sectionsToHtml(sections: TermsSection[]): string {
	const chunks: string[] = [];

	for (const section of sections) {
		chunks.push(`<h2>${section.number}. ${escapeHtml(section.title)}</h2>`);

		for (const sub of section.subsections) {
			chunks.push(`<h3>${escapeHtml(sub.code)}. ${escapeHtml(sub.title)}</h3>`);
			const paragraphs = sub.body
				.split(/\n+/)
				.map((line) => line.trim())
				.filter(Boolean);

			if (paragraphs.length === 0) {
				chunks.push("<p><br></p>");
			} else {
				for (const paragraph of paragraphs) {
					chunks.push(`<p>${escapeHtml(paragraph)}</p>`);
				}
			}
		}

		if (section.callout?.trim()) {
			chunks.push(`<blockquote>${escapeHtml(section.callout.trim())}</blockquote>`);
		}
	}

	return chunks.join("");
}

const SECTION_HEADING_PATTERN = /^(\d+)\.\s+(.+)$/;
const SUBSECTION_HEADING_PATTERN = /^(\d+\.\d+)\.?\s+(.+)$/;

interface WorkingSection {
	number: number;
	title: string;
	subsections: Array<{ code: string; title: string; lines: string[] }>;
	calloutLines: string[];
}

function ensureSection(sections: WorkingSection[], title = "Quy định chung"): WorkingSection {
	const existing = sections[sections.length - 1];
	if (existing) return existing;
	const created: WorkingSection = {
		number: 1,
		title,
		subsections: [],
		calloutLines: [],
	};
	sections.push(created);
	return created;
}

function ensureSubsection(section: WorkingSection) {
	const existing = section.subsections[section.subsections.length - 1];
	if (existing) return existing;
	const created = {
		code: `${section.number}.1`,
		title: section.title || "Nội dung chi tiết",
		lines: [] as string[],
	};
	section.subsections.push(created);
	return created;
}

function extractListText(listEl: Element): string[] {
	const isOrdered = listEl.tagName.toLowerCase() === "ol";
	const items = Array.from(listEl.children).filter((child) => child.tagName.toLowerCase() === "li");
	return items
		.map((li, index) => {
			const text = (li.textContent ?? "").replace(/\s+/g, " ").trim();
			if (!text) return "";
			return isOrdered ? `${index + 1}. ${text}` : `• ${text}`;
		})
		.filter(Boolean);
}

export function htmlToSections(html: string): TermsSection[] {
	const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
	const root = doc.body.firstElementChild;
	if (!root) return [];

	const working: WorkingSection[] = [];

	const processTextLine = (tag: string, rawText: string) => {
		const text = rawText
			.replace(/\u00A0/g, " ")
			.replace(/\s+/g, " ")
			.trim();
		if (!text) return;

		if (tag === "h1" || tag === "h2") {
			const match = SECTION_HEADING_PATTERN.exec(text);
			const nextNumber = working.length + 1;
			const title = match ? match[2].trim() : text;
			working.push({
				number: nextNumber,
				title,
				subsections: [],
				calloutLines: [],
			});
			return;
		}

		if (tag === "h3" || tag === "h4") {
			const currentSection = ensureSection(working);
			const match = SUBSECTION_HEADING_PATTERN.exec(text);
			const nextCode = match
				? match[1].trim()
				: `${currentSection.number}.${currentSection.subsections.length + 1}`;
			const title = match ? match[2].trim() : text;
			currentSection.subsections.push({
				code: nextCode,
				title,
				lines: [],
			});
			return;
		}

		if (tag === "blockquote") {
			const currentSection = ensureSection(working);
			currentSection.calloutLines.push(text);
			return;
		}

		// Plain paragraph / div: also detect typed headings like "13. Quy định mới" or "13.1. Chi tiết"
		const subMatch = SUBSECTION_HEADING_PATTERN.exec(text);
		if (subMatch && working.length > 0) {
			const currentSection = ensureSection(working);
			currentSection.subsections.push({
				code: subMatch[1].trim(),
				title: subMatch[2].trim(),
				lines: [],
			});
			return;
		}

		const secMatch = SECTION_HEADING_PATTERN.exec(text);
		if (secMatch && Number(secMatch[1]) === working.length + 1) {
			working.push({
				number: working.length + 1,
				title: secMatch[2].trim(),
				subsections: [],
				calloutLines: [],
			});
			return;
		}

		const currentSection = ensureSection(working);
		const currentSub = ensureSubsection(currentSection);
		currentSub.lines.push(text);
	};

	for (const node of Array.from(root.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			processTextLine("p", node.textContent ?? "");
			continue;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) continue;
		const el = node as Element;
		const tag = el.tagName.toLowerCase();

		if (tag === "ul" || tag === "ol") {
			const listLines = extractListText(el);
			if (listLines.length > 0) {
				const currentSection = ensureSection(working);
				const currentSub = ensureSubsection(currentSection);
				currentSub.lines.push(...listLines);
			}
			continue;
		}

		processTextLine(tag, el.textContent ?? "");
	}

	return working.map((sec, index) => {
		const number = index + 1;
		const subsections: TermsSubsection[] =
			sec.subsections.length > 0
				? sec.subsections.map((sub, subIdx) => ({
						code: sub.code || `${number}.${subIdx + 1}`,
						title: sub.title || `Điều mục ${number}.${subIdx + 1}`,
						body: sub.lines.join("\n").trim() || sub.title,
					}))
				: [
						{
							code: `${number}.1`,
							title: sec.title,
							body: sec.calloutLines.join("\n").trim() || sec.title,
						},
					];

		const callout = sec.calloutLines.join("\n").trim();

		return {
			number,
			slug: toVietnameseSlug(sec.title, number),
			title: sec.title,
			subsections,
			...(callout ? { callout } : {}),
		};
	});
}
