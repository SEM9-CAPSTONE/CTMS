import { useRef, useState } from "react";
import { Modal } from "../../../../shared/components";
import { toast } from "../../../../shared/components/Toast";
import { createUuid } from "../../../../shared/utils/uuid";
import { SOURCE_BUTTON } from "../../constants";
import { survivalDocumentsService as service } from "../../services/survival-documents.service";
import type {
	DocumentDetail,
	EditAction,
	EditDraft,
	EditorSection,
	SourceVersion,
} from "../../types";

const actions: Record<EditAction, string> = {
	KEEP: "Giữ nguyên",
	REPLACE: "Thay thế",
	REMOVE: "Loại bỏ",
	RESTORE: "Khôi phục",
	INSERT: "Thêm mục",
	REORDER: "Đổi thứ tự",
};
const field = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

function SectionContent({ section }: { section: EditorSection }) {
	return (
		<div className="space-y-2 py-2 text-sm text-slate-700">
			{section.items.map((item, index) =>
				item.kind === "table" ? (
					<div key={`${section.id}-${index}`} className="overflow-x-auto">
						<table className="w-full border-collapse text-left">
							<thead>
								<tr>
									{item.rows[0]?.map((cell, i) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: read-only PDF columns are identified by their original positions
										<th key={`${cell}-${i}`} scope="col" className="border p-2">
											{cell}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{item.rows.slice(1).map((row, i) => (
									<tr key={`${row.join("|")}-${i}`}>
										{row.map((cell, j) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: read-only PDF cells can share the same text
											<td key={`${cell}-${j}`} className="border p-2">
												{cell}
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : item.kind === "heading" ? (
					<p key={`${section.id}-${index}`} className="font-semibold">
						{item.text}
					</p>
				) : (
					<p key={`${section.id}-${index}`} className="whitespace-pre-wrap">
						{item.text}
					</p>
				)
			)}
			{section.source && (
				<p className="text-xs text-slate-600">
					{section.edited ? "Biên soạn dựa trên" : "Nguồn"} phiên bản {section.source.versionNumber}
					{section.pages.length ? ` · Trang ${section.pages.join(", ")}` : ""}
				</p>
			)}
		</div>
	);
}

interface Props {
	document: DocumentDetail;
	onClose: () => void;
	onSaved: (document: DocumentDetail, version: SourceVersion, publish: boolean) => Promise<void>;
}
export function VersionCompositionEditor({ document, onClose, onSaved }: Props) {
	const [draft, setDraft] = useState<EditDraft>();
	const [title, setTitle] = useState("");
	const [instruction, setInstruction] = useState("");
	const [action, setAction] = useState<EditAction>("REMOVE");
	const [target, setTarget] = useState("");
	const [historicalId, setHistoricalId] = useState("");
	const [historical, setHistorical] = useState<EditorSection[]>([]);
	const [restore, setRestore] = useState("");
	const [position, setPosition] = useState("1");
	const [heading, setHeading] = useState("");
	const [text, setText] = useState("");
	const [basis, setBasis] = useState("");
	const [busy, setBusy] = useState(false);
	const lock = useRef(false);
	const pendingRequest = useRef<{ key: string; id: string } | undefined>(undefined);
	const current = document.versions.find(({ id }) => id === document.currentPublishedVersionId);
	const versions = document.versions.filter((item) => item.id !== current?.id && item.publishedAt);
	const selectedHistory = historical.find((section) => section.id === restore);
	const usesHistory = action === "RESTORE" || (action === "REPLACE" && !!restore);
	const confirmed = draft?.confirmedRevision === draft?.revision;

	function request(name: string, payload?: unknown) {
		const key = JSON.stringify([name, draft?.revision, payload]);
		if (pendingRequest.current?.key !== key) pendingRequest.current = { key, id: createUuid() };
		return pendingRequest.current.id;
	}

	async function run(operation: () => Promise<void>) {
		if (lock.current) return;
		lock.current = true;
		setBusy(true);
		try {
			await operation();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không thể xử lý tài liệu. Vui lòng thử lại."
			);
		} finally {
			lock.current = false;
			setBusy(false);
		}
	}

	async function start() {
		const saved = await service.startEdit(document.id, document.revision);
		setDraft(saved);
		setTitle(saved.snapshot.title);
		setBasis(saved.snapshot.reviewBasis ?? "");
		setTarget(saved.snapshot.sections[0]?.id ?? "");
	}

	async function loadHistory(versionId: string) {
		setHistoricalId(versionId);
		setHistorical([]);
		setRestore("");
		if (versionId) setHistorical(await service.editorContent(document.id, versionId));
	}

	async function savePlan(mode: "operation" | "instruction" | "title") {
		if (!draft) return;
		const operation = {
			action,
			targetId: ["INSERT", "RESTORE"].includes(action) ? undefined : target,
			fromVersionId: usesHistory ? historicalId : undefined,
			fromSectionId: usesHistory ? restore : undefined,
			position: ["INSERT", "RESTORE", "REORDER"].includes(action)
				? Number(position) - 1
				: undefined,
			heading:
				!usesHistory && ["INSERT", "REPLACE"].includes(action)
					? heading.trim() || undefined
					: undefined,
			text: !usesHistory && ["INSERT", "REPLACE"].includes(action) ? text : undefined,
		};
		const payload = {
			title,
			instruction: mode === "instruction" ? instruction.trim() : undefined,
			operations: mode === "operation" ? [operation] : undefined,
		};
		const saved = await service.planEdit(document.id, draft.id, {
			...payload,
			expectedRevision: draft.revision,
			requestId: request("plan", payload),
		});
		setDraft(saved);
		setTitle(saved.snapshot.title);
		setTarget(
			saved.snapshot.sections.find(({ id }) => id === target)?.id ??
				saved.snapshot.sections[0]?.id ??
				""
		);
		setInstruction("");
		setHeading("");
		setText("");
		setBasis("");
		toast.success("Đã lưu bản nháp biên tập.");
	}

	async function confirm() {
		if (!draft) return;
		setDraft(
			await service.confirmEdit(document.id, draft.id, {
				reviewBasis: basis.trim(),
				expectedRevision: draft.revision,
				requestId: request("confirm", basis.trim()),
			})
		);
		toast.success("Đã xác nhận nội dung bản nháp.");
	}

	async function commit(publish: boolean) {
		if (!draft) return;
		const saved = await service.commitEdit(document.id, draft.id, {
			expectedRevision: draft.revision,
			requestId: request("commit"),
		});
		const version = saved.document.versions.find(({ id }) => id === saved.versionId);
		if (!version) throw new Error("Không tìm thấy phiên bản PDF đã tạo.");
		await onSaved(saved.document, version, publish);
	}

	return (
		<Modal
			isOpen
			onClose={onClose}
			isCloseDisabled={busy}
			size="2xl"
			title="Chỉnh sửa từ phiên bản hiện tại"
		>
			<fieldset disabled={busy} className="space-y-5">
				{current && (
					<p className="text-sm text-slate-600">
						Phiên bản cơ sở {current.versionNumber} · {current.metadata.sourceTitle}
					</p>
				)}
				{busy && <output className="text-sm text-slate-600">Đang xử lý tài liệu…</output>}
				{!draft ? (
					<button type="button" className={SOURCE_BUTTON} onClick={() => void run(start)}>
						Chuẩn bị bản nháp
					</button>
				) : (
					<>
						<div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
							<label className="space-y-1 text-sm font-medium">
								Tên tài liệu
								<input
									className={field}
									value={title}
									maxLength={300}
									onChange={(event) => setTitle(event.target.value)}
								/>
							</label>
							<button
								type="button"
								className={SOURCE_BUTTON}
								disabled={title === draft.snapshot.title}
								onClick={() => void run(() => savePlan("title"))}
							>
								Lưu tên tài liệu
							</button>
						</div>
						<div className="space-y-2">
							<label className="space-y-1 text-sm font-medium">
								Bạn muốn thay đổi nội dung nào?
								<textarea
									className={field}
									value={instruction}
									maxLength={2500}
									placeholder="Khôi phục mục Chuẩn bị từ phiên bản 1, loại bỏ mục Lịch trình cũ."
									onChange={(event) => setInstruction(event.target.value)}
								/>
							</label>
							<button
								type="button"
								className={SOURCE_BUTTON}
								disabled={!instruction.trim()}
								onClick={() => void run(() => savePlan("instruction"))}
							>
								Xem đề xuất thay đổi
							</button>
						</div>
						<section className="space-y-3 border-t pt-4">
							<h3 className="text-sm font-semibold">Thay đổi theo mục</h3>
							<div className="grid gap-3 sm:grid-cols-2">
								<label className="space-y-1 text-sm">
									Thao tác
									<select
										className={field}
										value={action}
										onChange={(event) => setAction(event.target.value as EditAction)}
									>
										{Object.entries(actions).map(([value, name]) => (
											<option key={value} value={value}>
												{name}
											</option>
										))}
									</select>
								</label>
								{!["INSERT", "RESTORE"].includes(action) && (
									<label className="space-y-1 text-sm">
										Mục trong bản nháp
										<select
											className={field}
											value={target}
											onChange={(event) => setTarget(event.target.value)}
										>
											{draft.snapshot.sections.map((section, i) => (
												<option key={section.id} value={section.id}>
													{i + 1}. {section.heading}
												</option>
											))}
										</select>
									</label>
								)}
								<label className="space-y-1 text-sm">
									Phiên bản để đối chiếu
									<select
										className={field}
										value={historicalId}
										onChange={(event) => void run(() => loadHistory(event.target.value))}
									>
										<option value="">Chọn phiên bản</option>
										{versions.map((version) => (
											<option key={version.id} value={version.id}>
												Phiên bản {version.versionNumber}
											</option>
										))}
									</select>
								</label>
								{historical.length > 0 && (
									<label className="space-y-1 text-sm">
										Mục trong phiên bản cũ
										<select
											className={field}
											value={restore}
											onChange={(event) => setRestore(event.target.value)}
										>
											<option value="">Chọn mục</option>
											{historical.map((section, i) => (
												<option key={section.id} value={section.id}>
													{i + 1}. {section.heading} · Trang {section.pages.join(", ")}
												</option>
											))}
										</select>
									</label>
								)}
								{["RESTORE", "INSERT", "REORDER"].includes(action) && (
									<label className="space-y-1 text-sm">
										Vị trí trong bản nháp
										<select
											className={field}
											value={position}
											onChange={(event) => setPosition(event.target.value)}
										>
											{Array.from(
												{ length: draft.snapshot.sections.length + Number(action !== "REORDER") },
												(_, i) => i + 1
											).map((index) => (
												<option key={index} value={index}>
													{index}
												</option>
											))}
										</select>
									</label>
								)}
							</div>
							{selectedHistory && (
								<details className="rounded-lg border p-3">
									<summary className="cursor-pointer text-sm font-medium">
										{selectedHistory.heading}
									</summary>
									<SectionContent section={selectedHistory} />
								</details>
							)}
							{!usesHistory && ["INSERT", "REPLACE"].includes(action) && (
								<div className="space-y-2">
									<label className="space-y-1 text-sm">
										Tiêu đề mục
										<input
											className={field}
											value={heading}
											maxLength={300}
											onChange={(event) => setHeading(event.target.value)}
										/>
									</label>
									<label className="space-y-1 text-sm">
										Nội dung mục
										<textarea
											className={field}
											value={text}
											maxLength={12000}
											onChange={(event) => setText(event.target.value)}
										/>
									</label>
								</div>
							)}
							<button
								type="button"
								className={SOURCE_BUTTON}
								disabled={action === "RESTORE" && !restore}
								onClick={() => void run(() => savePlan("operation"))}
							>
								Lưu bản nháp
							</button>
						</section>
						<section className="space-y-2 border-t pt-4">
							<h3 className="text-sm font-semibold">Xem trước và đối chiếu</h3>
							{draft.snapshot.changes.length > 0 && (
								<ul className="list-disc pl-5 text-sm text-slate-700">
									{draft.snapshot.changes.map((change, i) => (
										<li key={`${change.action}-${change.heading}-${i}`}>
											{actions[change.action]} {change.heading}
											{change.version ? ` từ phiên bản ${change.version}` : ""}
											{change.position !== undefined ? ` · Vị trí ${change.position + 1}` : ""}
										</li>
									))}
								</ul>
							)}
							<div className="grid gap-3 sm:grid-cols-2">
								{[
									{ label: "Phiên bản cơ sở", sections: draft.snapshot.baseSections },
									{ label: "Bản nháp đang biên tập", sections: draft.snapshot.sections },
								].map((column) => (
									<div key={column.label} className="space-y-2">
										<p className="text-sm font-medium">{column.label}</p>
										{column.sections.map((section, i) => (
											<details key={section.id} className="rounded-lg border p-2">
												<summary className="cursor-pointer text-sm">
													{i + 1}. {section.heading}
												</summary>
												<SectionContent section={section} />
											</details>
										))}
									</div>
								))}
							</div>
						</section>
						<section className="space-y-2 border-t pt-4">
							<label className="space-y-1 text-sm font-medium">
								Căn cứ xác nhận nội dung
								<textarea
									className={field}
									value={basis}
									maxLength={1800}
									placeholder="Ghi nguồn đối chiếu, các cảnh báo và điều kiện áp dụng đã kiểm tra."
									onChange={(event) => setBasis(event.target.value)}
								/>
							</label>
							<div className="flex flex-wrap justify-end gap-2">
								<button
									type="button"
									className={SOURCE_BUTTON}
									disabled={basis.trim().length < 10 || title !== draft.snapshot.title}
									onClick={() => void run(confirm)}
								>
									Xác nhận nội dung
								</button>
								<button
									type="button"
									className={SOURCE_BUTTON}
									disabled={
										!confirmed ||
										basis.trim() !== draft.snapshot.reviewBasis ||
										title !== draft.snapshot.title
									}
									onClick={() => void run(() => commit(false))}
								>
									Tạo bản nháp PDF
								</button>
								<button
									type="button"
									className={SOURCE_BUTTON}
									disabled={
										!confirmed ||
										basis.trim() !== draft.snapshot.reviewBasis ||
										title !== draft.snapshot.title
									}
									onClick={() => void run(() => commit(true))}
								>
									Tạo bản nháp và chuẩn bị nội dung
								</button>
							</div>
						</section>
					</>
				)}
			</fieldset>
		</Modal>
	);
}
