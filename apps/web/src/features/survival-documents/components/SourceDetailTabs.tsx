import { type KeyboardEvent, useId, useRef, useState } from "react";
import type { DocumentDetail, SourceVersion } from "../types";
import { DocumentAuditHistory, DocumentVersionHistory } from "./DocumentVersionHistory";
import { SourceVersionProvenance } from "./SourceVersionProvenance";

const tabs = ["Tổng quan", "Phiên bản", "Nhật ký"];

interface SourceDetailTabsProps {
	document: DocumentDetail;
	version: SourceVersion;
	busy: boolean;
	onSelectVersion: (id: string) => void;
}

export function SourceDetailTabs({
	document,
	version,
	busy,
	onSelectVersion,
}: SourceDetailTabsProps) {
	const [active, setActive] = useState(0);
	const id = useId();
	const buttons = useRef<Array<HTMLButtonElement | null>>([]);
	function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
		const destination: Record<string, number> = {
			ArrowLeft: (index + tabs.length - 1) % tabs.length,
			ArrowRight: (index + 1) % tabs.length,
			Home: 0,
			End: tabs.length - 1,
		};
		const next = destination[event.key];
		if (next === undefined) return;
		event.preventDefault();
		setActive(next);
		buttons.current[next]?.focus();
	}
	return (
		<div className="min-w-0 rounded-xl border border-[#dfe8df] p-3.5">
			<div
				role="tablist"
				aria-label="Thông tin tài liệu"
				className="mb-4 grid grid-cols-3 gap-1 rounded-full bg-[#f4f7f2] p-1"
			>
				{tabs.map((label, index) => (
					<button
						key={label}
						id={`${id}-tab-${index}`}
						ref={(element) => {
							buttons.current[index] = element;
						}}
						type="button"
						role="tab"
						aria-selected={active === index}
						aria-controls={`${id}-panel-${index}`}
						tabIndex={active === index ? 0 : -1}
						onClick={() => setActive(index)}
						onKeyDown={(event) => handleKey(event, index)}
						className={`rounded-full px-2 py-1.5 text-sm font-semibold ${active === index ? "bg-white text-[#164027] shadow-sm" : "text-[#526c5e]"}`}
					>
						{label}
					</button>
				))}
			</div>
			{tabs.map((tab, index) => (
				<div
					key={tab}
					role="tabpanel"
					id={`${id}-panel-${index}`}
					aria-labelledby={`${id}-tab-${index}`}
					hidden={active !== index}
				>
					{active === index && index === 0 && <SourceVersionProvenance version={version} />}
					{active === index && index === 1 && (
						<div className="space-y-4">
							<DocumentVersionHistory
								document={document}
								version={version}
								busy={busy}
								onSelectVersion={onSelectVersion}
							/>
						</div>
					)}
					{active === index && index === 2 && (
						<DocumentAuditHistory publishedAt={version.publishedAt} />
					)}
				</div>
			))}
		</div>
	);
}
