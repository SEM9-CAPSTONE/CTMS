import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { toast } from "../../../shared/components/Toast";
import { createUuid } from "../../../shared/utils/uuid";
import type {
	ContentVerification,
	VerificationPosition,
	VerificationSubmission,
} from "../content-verification.types";
import { usePdfDocument } from "../hooks/usePdfDocument";
import { useSourceFile } from "../hooks/useSourceFile";
import { survivalDocumentsService as service } from "../services/survival-documents.service";
import { PdfCanvas } from "./PdfCanvas";

const button = "rounded-lg border border-[#dfe8df] px-3 py-2 text-sm disabled:opacity-50";

function SourceRegion({
	documentId,
	versionId,
	position,
}: { documentId: string; versionId: string; position: VerificationPosition }) {
	const { file } = useSourceFile(documentId, versionId);
	const pdf = usePdfDocument(file.data);
	const [zoom, setZoom] = useState(1);
	return (
		<div className="min-w-0 space-y-2">
			<div className="flex items-center justify-between gap-2">
				<p className="text-sm font-medium">PDF gốc · Trang {position.page}</p>
				<div>
					<button
						type="button"
						className={button}
						disabled={zoom <= 1}
						onClick={() => setZoom(Math.max(1, zoom - 0.5))}
					>
						Thu nhỏ
					</button>{" "}
					<button
						type="button"
						className={button}
						disabled={zoom >= 3}
						onClick={() => setZoom(Math.min(3, zoom + 0.5))}
					>
						Phóng to
					</button>
				</div>
			</div>
			{file.isError || pdf?.failed ? (
				<p role="alert">
					Không tải được PDF.{" "}
					<button type="button" onClick={() => void file.refetch()}>
						Thử lại
					</button>
				</p>
			) : pdf?.document ? (
				<div className="max-h-[65vh] overflow-auto bg-[#f0f4f0] p-1">
					<PdfCanvas
						document={pdf.document}
						page={position.page}
						width={440}
						zoom={zoom}
						highlight={position.bbox}
						focusHighlight
					/>
				</div>
			) : (
				<output>Đang mở trang PDF…</output>
			)}
		</div>
	);
}

export function initialRows(position: VerificationPosition): string[][] {
	if (position.resolved && position.text.includes("|"))
		return position.text
			.split("\n")
			.filter((_, i) => i !== 1)
			.map((line) =>
				line
					.trim()
					.replace(/^\||\|$/g, "")
					.split("|")
					.map((cell) => cell.trim())
			);
	const table = position.table;
	if (!table)
		return [
			["", ""],
			["", ""],
		];
	return Array.from({ length: Math.max(2, table.num_rows) }, (_, row) =>
		Array.from(
			{ length: Math.max(1, table.num_cols) },
			(_, col) =>
				table.table_cells.find(
					(cell) => cell.start_row_offset_idx === row && cell.start_col_offset_idx === col
				)?.text ?? ""
		)
	);
}
export function tableText(rows: string[][]): string {
	return [rows[0], rows[0].map(() => "---"), ...rows.slice(1)]
		.map((row) => `| ${row.join(" | ")} |`)
		.join("\n");
}

function VerificationForm({
	position,
	state,
	documentId,
	versionId,
	onSaved,
	onBusy,
}: {
	position: VerificationPosition;
	state: ContentVerification;
	documentId: string;
	versionId: string;
	onSaved: (state: ContentVerification) => void;
	onBusy: (value: boolean) => void;
}) {
	const [text, setText] = useState(position.text);
	const [rows, setRows] = useState(() => initialRows(position));
	const [blocks, setBlocks] = useState(position.blocks ?? []);
	const [source, setSource] = useState(false);
	const [context, setContext] = useState(false);
	const [visual, setVisual] = useState(false);
	const [exclude, setExclude] = useState(false);
	const [emptyForm, setEmptyForm] = useState(false);
	const [reason, setReason] = useState("");
	const [anchor, setAnchor] = useState(position.afterItemRef ?? "");
	const receipt = useRef<{ signature: string; id: string }>();
	const mutation = useMutation({
		mutationFn: (payload: VerificationSubmission) =>
			service.verifyContent(documentId, versionId, position.id, payload),
		onSuccess: (data) => {
			toast.success("Đã lưu nội dung đối chiếu.");
			onSaved(data);
		},
		onError: () =>
			toast.error(
				"Chưa lưu được nội dung. Bản chỉnh sửa vẫn được giữ; hãy tải lại danh sách nếu có người khác vừa cập nhật."
			),
		onSettled: () => onBusy(false),
	});
	function save() {
		if (
			!emptyForm &&
			position.kind === "table" &&
			rows.some((row) => row.some((cell) => /[|\n]/.test(cell)))
		) {
			toast.error("Mỗi ô bảng cần giữ trên một dòng và không chứa dấu gạch đứng.");
			return;
		}
		const useBlocks = position.kind !== "table" && blocks.length > 1;
		const value = emptyForm
			? position.originalText
			: position.kind === "table"
				? tableText(rows)
				: useBlocks
					? blocks.map((block) => block.text).join("\n")
					: text;
		const body = {
			extractionId: state.extractionId as string,
			expectedRevision: state.revision,
			action: emptyForm
				? ("confirm" as const)
				: exclude
					? ("exclude" as const)
					: position.kind === "image"
						? ("describe" as const)
						: position.kind === "table" || value.trim() !== position.originalText.trim()
							? ("correct" as const)
							: ("confirm" as const),
			text: value,
			source_checked: source,
			context_checked: context,
			visual_checked: visual,
			...(exclude || emptyForm ? { reason } : {}),
			...(position.needsAnchor ? { after_item_ref: anchor } : {}),
			...(useBlocks
				? { block_texts: Object.fromEntries(blocks.map((block) => [block.ref, block.text])) }
				: {}),
		};
		const signature = JSON.stringify(body);
		if (receipt.current?.signature !== signature) receipt.current = { signature, id: createUuid() };
		onBusy(true);
		mutation.mutate({ ...body, requestId: receipt.current.id });
	}
	return (
		<fieldset disabled={mutation.isPending || state.preparing} className="min-w-0 space-y-3">
			<legend className="text-sm font-semibold">
				{position.kind === "image" ? "Mô tả nội dung hình ảnh" : "Nội dung đã đối chiếu"}
			</legend>
			{position.instruction && (
				<p className="text-sm text-muted-foreground">{position.instruction}</p>
			)}
			<details>
				<summary className="cursor-pointer text-sm">Văn bản trích xuất ban đầu</summary>
				<p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm">
					{position.originalText || "Chưa có văn bản trích xuất ở vùng này."}
				</p>
			</details>
			{position.alternativeText && (
				<details>
					<summary className="cursor-pointer text-sm">
						Văn bản đọc bổ sung — cần đối chiếu với PDF
					</summary>
					<p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm">
						{position.alternativeText}
					</p>
				</details>
			)}
			{position.emptyForm && (
				<label className="flex gap-2 text-sm">
					<input
						type="checkbox"
						checked={emptyForm}
						onChange={(e) => setEmptyForm(e.target.checked)}
					/>
					Tôi đã kiểm tra: đây là biểu mẫu trống, không có dữ liệu hoặc hướng dẫn cần sử dụng.
				</label>
			)}
			{emptyForm && (
				<textarea
					aria-label="Căn cứ xác nhận biểu mẫu trống"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					maxLength={1000}
					placeholder="Ghi rõ căn cứ sau khi kiểm tra PDF gốc và nội dung hình liên quan."
					className="w-full rounded border p-2 text-sm"
				/>
			)}
			{emptyForm ? (
				<p className="text-sm">
					Biểu mẫu được giữ nguyên; hệ thống không thêm dữ liệu vào các ô trống.
				</p>
			) : position.kind === "table" ? (
				<div className="space-y-2">
					<p className="text-xs">
						Đối chiếu đầy đủ hàng và cột; hàng đầu tiên là tiêu đề cột. Giữ nguyên các ô trống trong
						bản gốc.
					</p>
					{position.table?.table_cells.some(
						(cell) =>
							cell.end_row_offset_idx - cell.start_row_offset_idx > 1 ||
							cell.end_col_offset_idx - cell.start_col_offset_idx > 1
					) && (
						<p className="text-sm">
							Bảng gốc có ô gộp. Cần ghi đầy đủ tiêu đề nhiều tầng và nội dung tương ứng cho từng
							hàng, cột trước khi xác nhận.
						</p>
					)}
					<div className="overflow-auto">
						<table className="w-full">
							<tbody>
								{rows.map((row, r) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: Fixed source grid coordinates; rows are appended without reordering.
									<tr key={`row-${r}`}>
										{row.map((cell, c) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: Fixed source column coordinates; columns are appended without reordering.
											<td key={`col-${c}`} className="border p-1">
												<input
													aria-label={`Hàng ${r + 1}, cột ${c + 1}`}
													value={cell}
													className="w-full min-w-20 p-1 text-sm"
													onChange={(e) =>
														setRows(
															rows.map((line, i) =>
																line.map((value, j) =>
																	i === r && j === c ? e.target.value : value
																)
															)
														)
													}
												/>
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<button
						className={button}
						type="button"
						onClick={() => setRows([...rows, rows[0].map(() => "")])}
					>
						Thêm hàng
					</button>{" "}
					<button
						className={button}
						type="button"
						onClick={() => setRows(rows.map((row) => [...row, ""]))}
					>
						Thêm cột
					</button>
				</div>
			) : blocks.length > 1 ? (
				<div className="space-y-2">
					<p className="text-xs">Giữ từng đoạn và thứ tự theo bản gốc.</p>
					{blocks.map((block, i) => (
						<label className="block text-sm" key={block.ref}>
							Đoạn {i + 1}
							<textarea
								aria-label={`Nội dung đoạn ${i + 1}`}
								value={block.text}
								maxLength={30000}
								rows={3}
								className="w-full rounded border p-2"
								onChange={(e) =>
									setBlocks(
										blocks.map((item) =>
											item.ref === block.ref ? { ...item, text: e.target.value } : item
										)
									)
								}
							/>
						</label>
					))}
				</div>
			) : (
				<textarea
					aria-label={position.kind === "image" ? "Mô tả hình ảnh" : "Nội dung đối chiếu"}
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={9}
					maxLength={30000}
					className="w-full rounded-lg border p-3 text-sm"
					placeholder={
						position.kind === "image"
							? "Mô tả đầy đủ nội dung và hướng dẫn thể hiện trong hình sau khi đối chiếu PDF gốc."
							: "Nhập nội dung đúng theo PDF gốc."
					}
				/>
			)}
			{position.needsAnchor && (
				<label className="block text-sm">
					Đặt nội dung sau đoạn
					<select
						aria-label="Vị trí đặt nội dung"
						value={anchor}
						onChange={(e) => setAnchor(e.target.value)}
						className="mt-1 w-full rounded border p-2"
					>
						<option value="">Chọn đoạn trong trang</option>
						{position.anchors.map((item) => (
							<option key={item.ref} value={item.ref}>
								{item.text}
							</option>
						))}
					</select>
				</label>
			)}
			<details>
				<summary className="cursor-pointer text-sm">Nội dung xung quanh trong trang</summary>
				{position.anchors.map((item, i) => (
					<p key={item.ref} className="my-2 text-sm">
						{i + 1}. {item.text}
					</p>
				))}
			</details>
			<label className="flex gap-2 text-sm">
				<input type="checkbox" checked={source} onChange={(e) => setSource(e.target.checked)} />
				Tôi đã đối chiếu nội dung với vùng đánh dấu trong PDF gốc.
			</label>
			<label className="flex gap-2 text-sm">
				<input type="checkbox" checked={context} onChange={(e) => setContext(e.target.checked)} />
				Tôi đã kiểm tra nội dung xung quanh, thứ tự hướng dẫn, số liệu và đơn vị liên quan.
			</label>
			{position.needsVisualCheck && (
				<label className="flex gap-2 text-sm">
					<input type="checkbox" checked={visual} onChange={(e) => setVisual(e.target.checked)} />
					Tôi đã kiểm tra hình, chú thích và các hướng dẫn thể hiện trong hình.
				</label>
			)}
			{position.canExclude && (
				<>
					<label className="flex gap-2 text-sm">
						<input
							type="checkbox"
							checked={exclude}
							onChange={(e) => setExclude(e.target.checked)}
						/>
						Nhãn này không bổ sung kiến thức; nội dung hình liên quan đã được đối chiếu và mô tả đầy
						đủ.
					</label>
					{exclude && (
						<textarea
							aria-label="Lý do không sử dụng nhãn"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={1000}
							placeholder="Ghi rõ lý do không sử dụng nhãn này."
							className="w-full rounded border p-2 text-sm"
						/>
					)}
				</>
			)}
			<button
				type="button"
				className={`${button} bg-[#164027] text-white`}
				onClick={save}
				disabled={
					!source ||
					!context ||
					(position.needsVisualCheck && !visual) ||
					(position.needsAnchor && !anchor) ||
					(exclude || emptyForm
						? reason.trim().length < 10
						: position.kind === "image"
							? text.trim().length < 10
							: position.kind !== "table" && !text.trim())
				}
			>
				{mutation.isPending ? "Đang lưu…" : "Lưu xác minh"}
			</button>
		</fieldset>
	);
}

export function SourceChunkingStatus({
	documentId,
	versionId,
	current,
	eligible,
	blockedReason,
}: {
	documentId: string;
	versionId: string;
	current: boolean;
	eligible: boolean;
	blockedReason?: string | null;
}) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [selected, setSelected] = useState<string>();
	const client = useQueryClient();
	const key = ["survival-documents", documentId, versionId, "content-verification"];
	const query = useQuery({
		queryKey: key,
		queryFn: () => service.verification(documentId, versionId),
		enabled: current && eligible,
		refetchOnWindowFocus: !open,
		refetchOnReconnect: !open,
		refetchInterval: ({ state }) => (!state.data || state.data.preparing ? 5000 : false),
	});
	const data = query.data;
	const position =
		data?.positions.find((item) => item.id === selected) ??
		data?.positions.find((item) => !item.resolved) ??
		data?.positions[0];
	if (!current) return null;
	if (!eligible)
		return blockedReason ? <p className="text-sm text-muted-foreground">{blockedReason}</p> : null;
	return (
		<section className="space-y-2 border-b border-[#dfe8df] pb-3" aria-label="Đối chiếu nội dung">
			{data?.notice && <p className="text-sm text-muted-foreground">{data.notice}</p>}
			{query.isError ? (
				<p className="text-sm">
					Không tải được nội dung cần kiểm tra.{" "}
					<button type="button" onClick={() => void query.refetch()}>
						Thử lại
					</button>
				</p>
			) : query.isPending || data?.preparing ? (
				<output className="text-sm">
					{data?.inUse
						? "Đang cập nhật nội dung. Tài liệu vẫn sử dụng được."
						: "Đang chuẩn bị nội dung, vui lòng chờ…"}
				</output>
			) : data?.positions.some((item) => !item.resolved) ? (
				<p className="text-sm">Có một số nội dung cần kiểm tra trước khi xuất bản.</p>
			) : !data?.complete && (!data?.available || data.positions.every((item) => item.resolved)) ? (
				<p className="text-sm">
					{data?.inUse
						? "Chưa thể cập nhật nội dung. Tài liệu vẫn sử dụng được."
						: "Chưa thể chuẩn bị nội dung. Vui lòng kiểm tra lại sau."}
				</p>
			) : null}
			{!!data?.positions.length && (
				<button type="button" className={button} onClick={() => setOpen(true)}>
					{data.complete ? "Xem nội dung đã đối chiếu" : "Kiểm tra nội dung"}
				</button>
			)}
			<Modal
				isOpen={open}
				onClose={() => setOpen(false)}
				isCloseDisabled={busy}
				title="Đối chiếu nội dung tài liệu"
				size="2xl"
			>
				{data && position && (
					<>
						<div className="mb-4 flex items-end gap-2">
							<label className="min-w-0 flex-1 text-sm">
								Vị trí cần đối chiếu
								<select
									aria-label="Vị trí cần đối chiếu"
									className="mt-1 w-full rounded-lg border p-2"
									disabled={busy}
									value={position.id}
									onChange={(event) => setSelected(event.target.value)}
								>
									{data.positions.map((item, i) => (
										<option key={item.id} value={item.id}>
											Trang {item.page} · {item.label} {i + 1}
											{item.resolved ? " · Đã kiểm tra" : ""}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								className={button}
								disabled={busy}
								onClick={() => void query.refetch()}
							>
								Tải lại danh sách
							</button>
						</div>
						<div className="grid gap-5 md:grid-cols-2">
							<SourceRegion documentId={documentId} versionId={versionId} position={position} />
							<VerificationForm
								key={`${data.extractionId}/${position.id}/${data.revision}`}
								position={position}
								state={data}
								documentId={documentId}
								versionId={versionId}
								onBusy={setBusy}
								onSaved={(result) => client.setQueryData(key, result)}
							/>
						</div>
					</>
				)}
			</Modal>
		</section>
	);
}
