import { describe, expect, it } from "vitest";
import type { TermsSection } from "../types";
import { htmlToSections, sectionsToHtml } from "./termsDocumentConverter";

const SAMPLE_SECTIONS: TermsSection[] = [
	{
		number: 1,
		slug: "quy-dinh-chung",
		title: "Quy định chung",
		subsections: [
			{
				code: "1.1",
				title: "Phạm vi áp dụng",
				body: "Áp dụng cho toàn bộ người dùng CTMS.",
			},
			{
				code: "1.2",
				title: "Chấp thuận điều khoản",
				body: "Bằng việc đăng ký tài khoản, bạn đồng ý với điều khoản này.",
			},
		],
		callout: "Vui lòng đọc kỹ trước khi sử dụng.",
	},
	{
		number: 2,
		slug: "tai-khoan",
		title: "Tài khoản và vai trò",
		subsections: [
			{
				code: "2.1",
				title: "Vai trò hệ thống",
				body: "Gồm Người tham gia, Đơn vị tổ chức và Người dẫn đường.",
			},
		],
	},
];

describe("termsDocumentConverter", () => {
	it("round-trips structured sections to Word-style HTML and back without losing data", () => {
		const html = sectionsToHtml(SAMPLE_SECTIONS);
		expect(html).toContain("<h2>1. Quy định chung</h2>");
		expect(html).toContain("<h3>1.1. Phạm vi áp dụng</h3>");
		expect(html).toContain("<blockquote>Vui lòng đọc kỹ trước khi sử dụng.</blockquote>");

		const parsed = htmlToSections(html);
		expect(parsed).toHaveLength(2);
		expect(parsed[0]).toMatchObject({
			number: 1,
			slug: "quy-dinh-chung",
			title: "Quy định chung",
			callout: "Vui lòng đọc kỹ trước khi sử dụng.",
		});
		expect(parsed[0]?.subsections).toHaveLength(2);
		expect(parsed[0]?.subsections[0]?.body).toBe("Áp dụng cho toàn bộ người dùng CTMS.");
		expect(parsed[1]?.number).toBe(2);
	});

	it("parses a newly added section (e.g. section 3 / 13) typed like Word", () => {
		const html = `${sectionsToHtml(SAMPLE_SECTIONS)}<h2>3. Bảo vệ môi trường rừng</h2><h3>3.1. Không xả rác</h3><p>Người tham gia giữ gìn vệ sinh tự nhiên.</p>`;
		const parsed = htmlToSections(html);

		expect(parsed).toHaveLength(3);
		expect(parsed[2]).toMatchObject({
			number: 3,
			slug: "bao-ve-moi-truong-rung",
			title: "Bảo vệ môi trường rừng",
			subsections: [
				{
					code: "3.1",
					title: "Không xả rác",
					body: "Người tham gia giữ gìn vệ sinh tự nhiên.",
				},
			],
		});
	});
});
