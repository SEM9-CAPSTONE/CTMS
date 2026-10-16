import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataTable, type DataTableColumn } from "./DataTable";

interface Row {
	id: string;
	name: string;
	quantity: number;
}

const columns: DataTableColumn<Row>[] = [
	{ key: "name", header: "Tên", render: (row) => row.name },
	{ key: "quantity", header: "Số lượng", align: "right", render: (row) => row.quantity },
];

describe("DataTable", () => {
	it("renders a semantic table with column headers and one row per item", () => {
		render(
			<DataTable
				ariaLabel="Danh sách"
				columns={columns}
				rows={[
					{ id: "a", name: "Lều", quantity: 2 },
					{ id: "b", name: "Gậy", quantity: 5 },
				]}
				getRowKey={(row) => row.id}
				getRowTestId={(row) => `row-${row.id}`}
			/>
		);

		const table = screen.getByRole("table", { name: "Danh sách" });
		expect(
			within(table)
				.getAllByRole("columnheader")
				.map((th) => th.textContent)
		).toEqual(["Tên", "Số lượng"]);
		expect(screen.getByTestId("row-a")).toHaveTextContent("Lều");
		expect(screen.getByTestId("row-b")).toHaveTextContent("5");
		expect(within(screen.getByTestId("row-b")).getAllByRole("cell")[1]).toHaveClass("text-right");
	});

	it("shows the empty message when there are no rows", () => {
		render(
			<DataTable
				ariaLabel="Danh sách"
				columns={columns}
				rows={[]}
				getRowKey={(row) => row.id}
				emptyMessage="Chưa có thiết bị"
			/>
		);

		expect(screen.getByText("Chưa có thiết bị")).toBeInTheDocument();
	});
});
