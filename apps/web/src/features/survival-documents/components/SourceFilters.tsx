import { CATEGORY_LABELS, SOURCE_INPUT, STATUS_LABELS } from "../constants";
import type { SourceFilters as Filters } from "../types";
export function SourceFilters({
	filters,
	onChange,
}: { filters: Filters; onChange: (filters: Filters) => void }) {
	return (
		<div className="grid gap-3 md:grid-cols-4">
			<label className="text-sm">
				Tìm kiếm
				<input
					className={SOURCE_INPUT}
					value={filters.search}
					placeholder="Tên tài liệu hoặc tổ chức"
					onChange={(event) => onChange({ ...filters, page: 1, search: event.target.value })}
				/>
			</label>
			<label className="text-sm">
				Phân loại
				<select
					className={SOURCE_INPUT}
					value={filters.classification ?? ""}
					onChange={(event) =>
						onChange({
							...filters,
							page: 1,
							classification: (event.target.value as Filters["classification"]) || undefined,
						})
					}
				>
					<option value="">Tất cả phân loại</option>
					{Object.entries(CATEGORY_LABELS).map(([key, label]) => (
						<option key={key} value={key}>
							{label}
						</option>
					))}
				</select>
			</label>
			<label className="text-sm">
				Ngôn ngữ
				<select
					className={SOURCE_INPUT}
					value={filters.locale ?? ""}
					onChange={(event) =>
						onChange({ ...filters, page: 1, locale: event.target.value || undefined })
					}
				>
					<option value="">Tất cả ngôn ngữ</option>
					<option value="vi">Tiếng Việt</option>
					<option value="en">Tiếng Anh</option>
				</select>
			</label>
			<label className="text-sm">
				Trạng thái
				<select
					className={SOURCE_INPUT}
					value={filters.status ?? ""}
					onChange={(event) =>
						onChange({
							...filters,
							page: 1,
							status: (event.target.value as Filters["status"]) || undefined,
						})
					}
				>
					<option value="">Tất cả trạng thái</option>
					{Object.entries(STATUS_LABELS).map(([key, label]) => (
						<option key={key} value={key}>
							{label}
						</option>
					))}
				</select>
			</label>
		</div>
	);
}
