import { createHash, randomUUID } from "node:crypto";
import { invalidSource } from "./dto/source.dto";
import { Classification, type SourceVersion } from "./survival-documents.types";

export interface EditorItem {
	kind: "heading" | "paragraph" | "list" | "table";
	text: string;
	rows: string[][];
}

export interface ExtractedSection {
	heading: string;
	items: EditorItem[];
	pages: number[];
	item_refs: string[];
}

export interface EditorSection extends ExtractedSection {
	id: string;
	fingerprint: string;
	source: {
		versionId: string;
		versionNumber: number;
		checksum: string;
	} | null;
	edited?: boolean;
}

export enum EditAction {
	KEEP = "KEEP",
	REPLACE = "REPLACE",
	REMOVE = "REMOVE",
	RESTORE = "RESTORE",
	INSERT = "INSERT",
	REORDER = "REORDER",
}

export interface EditOperation {
	action: EditAction;
	targetId?: string;
	fromVersionId?: string;
	fromSectionId?: string;
	position?: number;
	heading?: string;
	text?: string;
}

export const versionAttribution = "Tài liệu do CTMS biên soạn từ các nguồn đã xác minh.";
const critical =
	/cảnh báo|nguy hiểm|điều kiện|chỉ áp dụng|không được|chống chỉ định|warning|danger|only if|do not|unless/iu;
export const fingerprint = (input: unknown) =>
	createHash("sha256").update(JSON.stringify(input)).digest("hex");
const nameKey = (name: string) =>
	name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("vi");

export function sourceSections(
	sections: ExtractedSection[],
	version: SourceVersion
): EditorSection[] {
	return sections.map((section) => ({
		...section,
		id: fingerprint([version.id, section.item_refs]),
		fingerprint: fingerprint(section.items),
		source: {
			versionId: version.id,
			versionNumber: version.versionNumber,
			checksum: version.checksum,
		},
	}));
}

export function oneSection(sections: EditorSection[], heading: string): EditorSection {
	const matches = sections.filter((section) => nameKey(section.heading) === nameKey(heading));
	if (matches.length !== 1)
		throw invalidSource(
			"Hãy chọn đúng mục cần sửa trong danh sách. Tên mục chưa xác định duy nhất."
		);
	return matches[0];
}

export function applyEditorOperations(
	base: EditorSection[],
	operations: EditOperation[],
	history: Map<string, EditorSection[]>
): EditorSection[] {
	const sections = [...base];
	for (const op of operations) {
		const index = sections.findIndex((section) => section.id === op.targetId);
		if (
			[EditAction.KEEP, EditAction.REMOVE, EditAction.REPLACE, EditAction.REORDER].includes(
				op.action
			) &&
			index < 0
		)
			throw invalidSource("Không tìm thấy mục cần thay đổi trong bản nháp.");
		if (op.action === EditAction.KEEP) continue;
		if (op.action === EditAction.REMOVE) {
			sections.splice(index, 1);
			continue;
		}
		if (op.action === EditAction.REORDER) {
			const [section] = sections.splice(index, 1);
			insert(section, op.position);
			continue;
		}

		const historical = op.fromVersionId
			? history.get(op.fromVersionId)?.find((item) => item.id === op.fromSectionId)
			: undefined;
		if ((op.action === EditAction.RESTORE || op.fromVersionId || op.fromSectionId) && !historical)
			throw invalidSource("Không tìm thấy mục ở phiên bản lịch sử đã chọn.");
		if (historical && op.action !== EditAction.RESTORE && op.action !== EditAction.REPLACE)
			throw invalidSource("Hãy chọn khôi phục hoặc thay thế khi sử dụng mục lịch sử.");

		const target = index < 0 ? undefined : sections[index];
		const heading = op.heading?.trim() || target?.heading;
		const text = op.text?.trim();
		if (!historical && (!text || !heading))
			throw invalidSource("Hãy nhập tiêu đề và nội dung của mục.");
		if (
			!historical &&
			target?.items.some(
				(item) =>
					item.kind === "table" ||
					item.kind === "list" ||
					item.text.split("\n").some((line) => critical.test(line) && !text?.includes(line.trim()))
			)
		)
			throw invalidSource(
				"Mục này có bảng, danh sách hoặc cảnh báo. Hãy giữ nguyên cấu trúc và cảnh báo hoặc đối chiếu một mục lịch sử đầy đủ."
			);
		const items: EditorItem[] = [
			{ kind: "heading", text: heading ?? "", rows: [] },
			{ kind: "paragraph", text: text ?? "", rows: [] },
		];
		const next: EditorSection = historical ?? {
			id: randomUUID(),
			heading: heading ?? "",
			items,
			fingerprint: fingerprint(items),
			source: target?.source ?? null,
			pages: target?.pages ?? [],
			item_refs: target?.item_refs ?? [],
			edited: true,
		};
		if (op.action === EditAction.REPLACE) sections.splice(index, 1);
		if (sections.some((section) => nameKey(section.heading) === nameKey(next.heading)))
			throw invalidSource(
				"Bản nháp có mục cùng tên. Hãy chỉ rõ mục cần thay thế hoặc đổi tên mục mới."
			);
		insert(next, op.action === EditAction.REPLACE ? index : op.position);
	}
	if (!sections.length || sections.length > 200)
		throw invalidSource("Bản nháp phải có từ 1 đến 200 mục.");
	return sections;

	function insert(section: EditorSection, position = sections.length) {
		if (position < 0 || position > sections.length)
			throw invalidSource("Vị trí mục nằm ngoài thứ tự tài liệu.");
		sections.splice(position, 0, section);
	}
}

export function isMedicalSource(classification: Classification) {
	return (
		classification === Classification.FIRST_AID ||
		classification === Classification.MEDICAL_REFERENCE
	);
}

function configuredChecksum(key: string, checksum: string) {
	return (
		/^[a-f0-9]{64}$/.test(checksum) &&
		(process.env[key] ?? "")
			.toLowerCase()
			.split(",")
			.some((value) => value.trim() === checksum)
	);
}

export function assertAdaptationGrants(checksums: string[]): void {
	if (
		!checksums.length ||
		checksums.some((checksum) => !configuredChecksum("SURVIVAL_EDITOR_APPROVED_SHA256", checksum))
	)
		throw invalidSource(
			"Chưa có xác nhận quyền biên soạn, lưu trữ và xử lý cho tất cả phiên bản PDF được sử dụng."
		);
}

export function assertComposedMedicalReview(
	classification: Classification,
	checksum: string
): void {
	if (
		isMedicalSource(classification) &&
		!configuredChecksum("SURVIVAL_EDITOR_MEDICAL_APPROVED_SHA256", checksum)
	)
		throw invalidSource(
			"PDF biên soạn cần được chuyên gia xác nhận theo đúng tệp này trước khi xuất bản."
		);
}
