import {
	EditAction,
	type EditorSection,
	applyEditorOperations,
	assertAdaptationGrants,
	assertComposedMedicalReview,
	assertEditorContext,
	oneSection,
} from "./document-editor.policy";
import { Classification } from "./survival-documents.types";

const v1 = "history";
const v2 = "current";
function section(heading: string, versionId = v2): EditorSection {
	return {
		id: `${versionId}-${heading}`,
		heading,
		fingerprint: heading,
		pages: [1],
		item_refs: ["#/texts/0"],
		items: [{ kind: "paragraph", text: heading, rows: [] }],
		source: { versionId, versionNumber: versionId === v1 ? 1 : 2, checksum: "a".repeat(64) },
	};
}

describe("Survival document composition", () => {
	it("constructs ABCDG, retains C's exact origin and leaves both snapshots intact", () => {
		const previous = [..."ABCDE"].map((key) => section(key, v1));
		const current = [..."ABDFG"].map((key) => section(key));
		const output = applyEditorOperations(
			current,
			[
				{ action: EditAction.RESTORE, fromVersionId: v1, fromSectionId: "history-C", position: 2 },
				{ action: EditAction.REMOVE, targetId: "current-F" },
				{ action: EditAction.KEEP, targetId: "current-D" },
			],
			new Map([[v1, previous]])
		);
		expect(output.map(({ heading }) => heading).join("")).toBe("ABCDG");
		expect(output[2]).toBe(previous[2]);
		expect(previous.map(({ heading }) => heading).join("")).toBe("ABCDE");
		expect(current.map(({ heading }) => heading).join("")).toBe("ABDFG");
	});

	it("requires explicit replacement when a historical topic is already present", () => {
		const current = [section("Học phí")];
		const previous = section("HỌC PHÍ", v1);
		const history = new Map([[v1, [previous]]]);
		const from = { fromVersionId: v1, fromSectionId: previous.id };
		expect(() =>
			applyEditorOperations(current, [{ action: EditAction.RESTORE, ...from }], history)
		).toThrow("cùng tên");
		expect(
			applyEditorOperations(
				current,
				[{ action: EditAction.REPLACE, targetId: current[0].id, ...from }],
				history
			)
		).toEqual([previous]);
		expect(() => oneSection([...current, previous], "Học phí")).toThrow("chưa xác định duy nhất");
	});

	it("adds and moves explicit content and keeps inherited provenance separate from new text", () => {
		const result = applyEditorOperations(
			[section("A"), section("B")],
			[
				{ action: EditAction.INSERT, heading: "C", text: "Phần bổ sung", position: 1 },
				{ action: EditAction.REORDER, targetId: "current-B", position: 0 },
			],
			new Map()
		);
		expect(result.map(({ heading }) => heading).join("")).toBe("BAC");
		expect(result[2]).toMatchObject({ source: null, edited: true });
	});

	it("flags changed quantities even when the source headings differ", () => {
		const current = section("Mức thu mới");
		const previous = section("Chi phí đăng ký", v1);
		current.items[0].text = "Học phí của môn A là 5 triệu đồng.";
		previous.items[0].text = "Học phí của môn A là 2 triệu đồng.";
		const history = new Map([[v1, [previous]]]);
		const from = { fromVersionId: v1, fromSectionId: previous.id };
		expect(() =>
			applyEditorOperations([current], [{ action: EditAction.RESTORE, ...from }], history)
		).toThrow("số liệu khác nhau");
		expect(
			applyEditorOperations(
				[current],
				[{ action: EditAction.REPLACE, targetId: current.id, ...from }],
				history
			)
		).toEqual([previous]);
	});

	it("blocks a rewrite that loses a warning or flattens a table", () => {
		const protectedSection = section("Cảnh báo");
		protectedSection.items = [
			{ kind: "paragraph", text: "Cảnh báo: Chỉ áp dụng khi đã được xác nhận.", rows: [] },
		];
		const operation = {
			action: EditAction.REPLACE,
			targetId: protectedSection.id,
			text: "Nội dung khác",
		};
		expect(() => applyEditorOperations([protectedSection], [operation], new Map())).toThrow(
			"cảnh báo"
		);
		protectedSection.items = [
			{
				kind: "table",
				text: "",
				rows: [
					["Mục", "Đơn vị"],
					["A", "m"],
				],
			},
		];
		expect(() => applyEditorOperations([protectedSection], [operation], new Map())).toThrow(
			"có bảng"
		);
	});

	it("requires referenced shared warnings to remain with any reused section", () => {
		const warning = section("Cảnh báo", v1);
		const guidance = section("Chuẩn bị", v1);
		if (!guidance.source) throw new Error("Expected a historical section");
		guidance.source.sharedContext = [warning.fingerprint];
		expect(() => assertEditorContext([guidance])).toThrow("điều kiện áp dụng đi kèm");
		expect(() => assertEditorContext([guidance, warning])).not.toThrow();
	});

	it("requires separately configured checksums for source adaptation and final medical review", () => {
		const key = "SURVIVAL_EDITOR_APPROVED_SHA256";
		const medicalKey = "SURVIVAL_EDITOR_MEDICAL_APPROVED_SHA256";
		const old = [process.env[key], process.env[medicalKey]];
		const source = "a".repeat(64);
		const composed = "b".repeat(64);
		try {
			process.env[key] = source;
			process.env[medicalKey] = "";
			expect(() => assertAdaptationGrants([source])).not.toThrow();
			expect(() => assertAdaptationGrants([source, composed])).toThrow("quyền biên soạn");
			expect(() => assertComposedMedicalReview(Classification.FIRST_AID, composed)).toThrow(
				"chuyên gia"
			);
			process.env[medicalKey] = composed;
			expect(() => assertComposedMedicalReview(Classification.FIRST_AID, composed)).not.toThrow();
		} finally {
			if (old[0] === undefined) delete process.env[key];
			else process.env[key] = old[0];
			if (old[1] === undefined) delete process.env[medicalKey];
			else process.env[medicalKey] = old[1];
		}
	});
});
