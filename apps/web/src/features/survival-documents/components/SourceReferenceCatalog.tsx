import { CATEGORY_LABELS, SOURCE_BUTTON } from "../constants";
import type { SourceReference } from "../types";
export function SourceReferenceCatalog({
	items,
	onSelect,
	disabled,
}: { items: SourceReference[]; onSelect: (item: SourceReference) => void; disabled: boolean }) {
	return (
		<details className="rounded-2xl border border-[#dfe8df] bg-white p-4">
			<summary className="cursor-pointer font-bold text-[#164027]">Gợi ý nguồn chính thống</summary>
			<p className="my-3 text-sm text-amber-800">
				Chọn “Điền thông tin nguồn” để mở biểu mẫu có sẵn thông tin tham khảo. Bạn cần tự tải PDF
				lên và bổ sung minh chứng quyền sử dụng.
			</p>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{items.map((item) => (
					<article key={item.id} className="rounded-xl border border-[#dfe8df] p-3 text-sm">
						<p className="font-bold">{item.publisher}</p>
						<p>{item.title}</p>
						<p className="text-[#667a6d]">
							{CATEGORY_LABELS[item.category]} · Cần duyệt từng tài liệu
						</p>
						<div className="my-2 flex gap-3">
							<a
								className="underline"
								href={item.contentUrl}
								target="_blank"
								rel="noopener noreferrer"
							>
								Xem nguồn gốc
							</a>
							{item.rightsPolicyUrl && (
								<a
									className="underline"
									href={item.rightsPolicyUrl}
									target="_blank"
									rel="noopener noreferrer"
								>
									Điều khoản sử dụng
								</a>
							)}
						</div>
						<button
							type="button"
							disabled={disabled}
							className={SOURCE_BUTTON}
							onClick={() => onSelect(item)}
						>
							Điền thông tin nguồn
						</button>
					</article>
				))}
			</div>
		</details>
	);
}
