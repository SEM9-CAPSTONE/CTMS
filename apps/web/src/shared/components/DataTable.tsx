import type { ReactNode } from "react";

export interface DataTableColumn<T> {
	key: string;
	header: ReactNode;
	render: (row: T) => ReactNode;
	align?: "left" | "right" | "center";
	/** Extra classes for both the header and body cells of this column (e.g. a width). */
	className?: string;
}

export interface DataTableProps<T> {
	columns: DataTableColumn<T>[];
	rows: T[];
	getRowKey: (row: T) => string;
	getRowTestId?: (row: T) => string;
	ariaLabel: string;
	emptyMessage?: ReactNode;
	/** Below this width the table scrolls horizontally instead of squashing columns. */
	minWidthClassName?: string;
}

const alignStyles = {
	left: "text-left",
	right: "text-right",
	center: "text-center",
};

/** Shared list table matching the existing CTMS table look (Admin accounts, refunds, wallet...). */
export function DataTable<T>({
	columns,
	rows,
	getRowKey,
	getRowTestId,
	ariaLabel,
	emptyMessage = "Không có dữ liệu",
	minWidthClassName = "min-w-[720px]",
}: DataTableProps<T>) {
	return (
		<div className="overflow-hidden rounded-2xl border border-[#dfe8df] bg-white shadow-sm">
			<div className="overflow-x-auto">
				<table aria-label={ariaLabel} className={`w-full text-sm ${minWidthClassName}`}>
					<thead className="bg-[#f4f7f2] text-xs uppercase tracking-wide text-[#667a6d]">
						<tr>
							{columns.map((column) => (
								<th
									key={column.key}
									scope="col"
									className={`whitespace-nowrap px-4 py-3 font-extrabold ${alignStyles[column.align ?? "left"]} ${column.className ?? ""}`}
								>
									{column.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-[#e8efe7]">
						{rows.length === 0 ? (
							<tr>
								<td
									colSpan={columns.length}
									className="px-4 py-8 text-center font-bold text-[#667a6d]"
								>
									{emptyMessage}
								</td>
							</tr>
						) : (
							rows.map((row) => (
								<tr
									key={getRowKey(row)}
									data-testid={getRowTestId?.(row)}
									className="hover:bg-[#f8faf7]"
								>
									{columns.map((column) => (
										<td
											key={column.key}
											className={`px-4 py-3 align-middle ${alignStyles[column.align ?? "left"]} ${column.className ?? ""}`}
										>
											{column.render(row)}
										</td>
									))}
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}
