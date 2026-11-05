import { useEffect, useState } from "react";
import { DocumentPreview } from "../DocumentPreview";

interface LocalPdfPreviewProps {
	file: File;
}

export function LocalPdfPreview({ file }: LocalPdfPreviewProps) {
	const [result, setResult] = useState<{ file: File; accepted: boolean }>();
	const [open, setOpen] = useState(false);
	useEffect(() => {
		let active = true;
		const header = file.slice(0, 8);
		if (typeof header.text === "function") {
			void header
				.text()
				.then((text) => {
					if (active) setResult({ file, accepted: /^%PDF-\d\.\d$/.test(text) });
				})
				.catch(() => {
					if (active) setResult({ file, accepted: false });
				});
		} else {
			setResult({ file, accepted: false });
		}
		return () => {
			active = false;
		};
	}, [file]);
	const checked = result?.file === file ? result : undefined;
	return (
		<details
			className="rounded-lg border border-[#dfe8df] p-3 text-sm"
			onToggle={(event) => setOpen(event.currentTarget.open)}
		>
			<summary className="cursor-pointer font-semibold">Xem trước PDF đã chọn</summary>
			{open && !checked && <output className="mt-2 block">Đang kiểm tra tệp PDF…</output>}
			{open &&
				checked &&
				(checked.accepted ? (
					<div className="mt-2">
						<DocumentPreview blob={file} filename={file.name} />
					</div>
				) : (
					<p className="mt-2">Không đọc được phần đầu của tệp PDF.</p>
				))}
		</details>
	);
}
