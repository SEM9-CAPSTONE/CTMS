import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs design:paramtypes metadata at runtime
import { ConfigService } from "@nestjs/config";
import type { GuideCardExtraction } from "../entities/porter-verification-document.entity";

export const GUIDE_CARD_EXTRACTION_PROVIDER = Symbol("GUIDE_CARD_EXTRACTION_PROVIDER");

export interface GuideCardExtractionProvider {
	/**
	 * Reads the card fields from an image. Never throws: an unconfigured or failing AI service
	 * gives `{ status: "unavailable" }`, so a Porter can always upload and the Admin still reviews.
	 */
	extract(image: Buffer, mimeType: string): Promise<GuideCardExtraction>;
}

const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CARD_TYPES = new Set(["noi_dia", "quoc_te", "tai_diem", "unknown"]);
const DEFAULT_TIMEOUT_MS = 20_000;

/** Calls `POST {AI_SERVICE_URL}/guide-card-extraction` with the internal AI service token. */
@Injectable()
export class HttpGuideCardExtractionProvider implements GuideCardExtractionProvider {
	constructor(private readonly config: ConfigService) {}

	async extract(image: Buffer, mimeType: string): Promise<GuideCardExtraction> {
		if (!IMAGE_MIME_TYPES.has(mimeType)) return { status: "unavailable", code: "not_an_image" };
		const token = this.config.get<string>("AI_REVIEW_SERVICE_TOKEN")?.trim();
		if (!token) return { status: "unavailable", code: "provider_not_configured" };
		const baseUrl = this.config.get<string>("AI_SERVICE_URL") ?? "http://localhost:8000";
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
		try {
			const response = await fetch(`${baseUrl}/guide-card-extraction`, {
				method: "POST",
				headers: { "Content-Type": "application/json", "X-CTMS-AI-Token": token },
				body: JSON.stringify({ image_base64: image.toString("base64"), mime_type: mimeType }),
				signal: controller.signal,
			});
			if (!response.ok) return { status: "unavailable", code: `provider_http_${response.status}` };
			return parseExtraction(await response.json());
		} catch {
			return { status: "unavailable", code: "provider_transport" };
		} finally {
			clearTimeout(timeout);
		}
	}
}

export function parseExtraction(body: unknown): GuideCardExtraction {
	const value = (body ?? {}) as Record<string, unknown>;
	const text = (field: unknown) =>
		typeof field === "string" && field.trim() ? field.trim() : null;
	const cardNumber = text(value.card_number);
	const expiresOn = text(value.expires_on);
	if (
		typeof value.is_guide_card !== "boolean" ||
		typeof value.card_type !== "string" ||
		!CARD_TYPES.has(value.card_type) ||
		typeof value.confidence !== "number" ||
		!Number.isFinite(value.confidence) ||
		value.confidence < 0 ||
		value.confidence > 1 ||
		(cardNumber !== null && !/^\d+$/.test(cardNumber)) ||
		(expiresOn !== null && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn))
	) {
		return { status: "unavailable", code: "invalid_output" };
	}
	return {
		status: "read",
		isGuideCard: value.is_guide_card,
		fullName: text(value.full_name)?.slice(0, 120) ?? null,
		cardNumber,
		cardType: value.card_type as "noi_dia" | "quoc_te" | "tai_diem" | "unknown",
		expiresOn,
		confidence: value.confidence,
		model: text(value.model)?.slice(0, 200) ?? "unknown",
	};
}
