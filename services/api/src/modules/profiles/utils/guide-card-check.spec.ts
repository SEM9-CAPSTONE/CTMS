import type { GuideCardExtraction } from "../entities/porter-verification-document.entity";
import { GuideCardType } from "../entities/porter-verification.entity";
import { parseExtraction } from "../providers/guide-card-extraction.provider";
import {
	GuideCardLabel,
	autoRejectionReason,
	checkGuideCard,
	vietnamToday,
} from "./guide-card-check";

const TODAY = "2026-11-13";
const declaration = {
	cardType: GuideCardType.DOMESTIC,
	cardNumber: "000000000",
	expiresOn: "2030-01-01",
};

function read(
	overrides: Partial<Extract<GuideCardExtraction, { status: "read" }>> = {}
): GuideCardExtraction {
	return {
		status: "read",
		isGuideCard: true,
		fullName: "NGUYỄN VĂN MẪU",
		cardNumber: "000000000",
		cardType: "noi_dia",
		expiresOn: "2030-01-01",
		confidence: 0.9,
		model: "test",
		...overrides,
	};
}

const check = (
	extraction: GuideCardExtraction | null,
	accountName: string | null = "Nguyễn Văn Mẫu"
) =>
	checkGuideCard({ declaration, accountName, documents: [{ id: "d1", extraction }], today: TODAY });

describe("checkGuideCard", () => {
	it("has no label when the photo matches the declaration and the account name (diacritics and case ignored)", () => {
		expect(check(read())).toMatchObject({
			labels: [],
			autoRejected: false,
			reading: { documentId: "d1" },
		});
	});

	it("auto-rejects a card expired on the photo or a site-only card", () => {
		expect(check(read({ expiresOn: "2026-11-12" }))).toMatchObject({ autoRejected: true });
		expect(check(read({ expiresOn: "2026-11-12" })).labels).toContain(GuideCardLabel.CARD_EXPIRED);
		expect(check(read({ expiresOn: TODAY })).labels).not.toContain(GuideCardLabel.CARD_EXPIRED);
		const siteOnly = check(read({ cardType: "tai_diem" }));
		expect(siteOnly).toMatchObject({ autoRejected: true });
		expect(siteOnly.labels).toEqual([GuideCardLabel.CARD_TYPE_SITE_ONLY]);
	});

	it("labels name, number, type and expiry mismatches without rejecting", () => {
		const result = check(
			read({
				fullName: "Trần Thị B",
				cardNumber: "111111111",
				cardType: "quoc_te",
				expiresOn: "2031-01-01",
			})
		);
		expect(result.autoRejected).toBe(false);
		expect(result.labels).toEqual([
			GuideCardLabel.NAME_MISMATCH,
			GuideCardLabel.NUMBER_MISMATCH,
			GuideCardLabel.TYPE_MISMATCH,
			GuideCardLabel.EXPIRY_MISMATCH,
		]);
		expect(check(read(), null).labels).toEqual([GuideCardLabel.ACCOUNT_NAME_MISSING]);
	});

	it("says the card was not read when no photo is a readable guide card", () => {
		for (const extraction of [
			null,
			{ status: "unavailable", code: "x" } as GuideCardExtraction,
			read({ isGuideCard: false }),
		]) {
			expect(check(extraction)).toEqual({
				labels: [GuideCardLabel.CARD_NOT_READ],
				reading: null,
				autoRejected: false,
			});
		}
	});

	it("uses the newest readable photo", () => {
		const result = checkGuideCard({
			declaration,
			accountName: "Nguyễn Văn Mẫu",
			documents: [
				{ id: "old", extraction: read({ cardNumber: "111111111" }) },
				{ id: "new", extraction: read() },
				{ id: "pdf", extraction: { status: "unavailable", code: "not_an_image" } },
			],
			today: TODAY,
		});
		expect(result.reading?.documentId).toBe("new");
		expect(result.labels).toEqual([]);
	});

	it("explains an automatic rejection to the Porter", () => {
		expect(autoRejectionReason(check(read({ expiresOn: "2024-01-01" })))).toContain(
			"đã hết hạn (01/01/2024)"
		);
		expect(autoRejectionReason(check(read({ cardType: "tai_diem" })))).toContain("tại điểm");
		expect(autoRejectionReason(check(read()))).toBeNull();
	});

	it("uses the Vietnam calendar date", () => {
		expect(vietnamToday(new Date("2026-11-12T18:00:00.000Z"))).toBe("2026-11-13");
		expect(vietnamToday(new Date("2026-11-12T16:00:00.000Z"))).toBe("2026-11-12");
	});
});

describe("parseExtraction", () => {
	it("accepts a well-formed reading and rejects anything else", () => {
		expect(
			parseExtraction({
				is_guide_card: true,
				full_name: "A",
				card_number: "123",
				card_type: "quoc_te",
				expires_on: "2030-01-01",
				confidence: 0.5,
				model: "m",
			})
		).toMatchObject({ status: "read", cardNumber: "123", cardType: "quoc_te" });
		expect(parseExtraction({ is_guide_card: true, card_type: "other", confidence: 0.5 })).toEqual({
			status: "unavailable",
			code: "invalid_output",
		});
		expect(parseExtraction({ is_guide_card: true, card_type: "noi_dia", confidence: 2 })).toEqual({
			status: "unavailable",
			code: "invalid_output",
		});
		expect(
			parseExtraction({
				is_guide_card: true,
				card_type: "noi_dia",
				confidence: 0.5,
				expires_on: "01/01/2030",
			})
		).toEqual({ status: "unavailable", code: "invalid_output" });
	});
});
