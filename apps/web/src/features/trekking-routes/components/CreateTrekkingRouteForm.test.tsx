import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GeoJsonLineString } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";

vi.mock("./RouteGeometryEditor", () => ({
	RouteGeometryEditor: ({
		value,
		onChange,
	}: { value: GeoJsonLineString; onChange: (value: GeoJsonLineString) => void }) => (
		<div>
			<span data-testid="vertex-count">{value.coordinates.length}</span>
			<button
				type="button"
				onClick={() =>
					onChange({
						type: "LineString",
						coordinates: [
							[108.45, 11.94],
							[108.46, 11.95],
						],
					})
				}
			>
				Draw test route
			</button>
		</div>
	),
}));

const campsites = [{ id: "11111111-1111-4111-8111-111111111111", name: "Pine Camp" }];

describe("CreateTrekkingRouteForm", () => {
	it("preselects the owned campsite supplied by the page", () => {
		render(
			<CreateTrekkingRouteForm
				campsites={campsites as never}
				initialCampsiteId={campsites[0].id}
				isSubmitting={false}
				error={null}
				onSubmit={vi.fn()}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByLabelText("Khu cắm trại")).toHaveValue(campsites[0].id);
	});

	it("validates metadata and submits the exact payload", async () => {
		const submit = vi.fn().mockResolvedValue(null);
		render(
			<CreateTrekkingRouteForm
				campsites={campsites as never}
				isSubmitting={false}
				error={null}
				onSubmit={submit}
				onRetry={vi.fn()}
			/>
		);
		fireEvent.change(screen.getByLabelText("Khu cắm trại"), { target: { value: campsites[0].id } });
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "  Ridge  " } });
		fireEvent.change(screen.getByLabelText("Độ khó"), { target: { value: "hard" } });
		fireEvent.change(screen.getByLabelText("Thời lượng dự kiến (phút)"), {
			target: { value: "120" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Draw test route" }));
		fireEvent.click(screen.getByRole("button", { name: "Tạo tuyến đường" }));
		await waitFor(() =>
			expect(submit).toHaveBeenCalledWith({
				campsiteId: campsites[0].id,
				name: "Ridge",
				geometry: {
					type: "LineString",
					coordinates: [
						[108.45, 11.94],
						[108.46, 11.95],
					],
				},
				difficulty: "hard",
				expectedDurationMinutes: 120,
			})
		);
	});

	it("preserves values and geometry when an API error is displayed", () => {
		render(
			<CreateTrekkingRouteForm
				campsites={campsites as never}
				isSubmitting={false}
				error={{ status: 422, message: "invalid", canRetry: false }}
				onSubmit={vi.fn()}
				onRetry={vi.fn()}
			/>
		);
		fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: "Keep me" } });
		fireEvent.click(screen.getByRole("button", { name: "Draw test route" }));
		expect(screen.getByLabelText("Tên tuyến")).toHaveValue("Keep me");
		expect(screen.getByTestId("vertex-count")).toHaveTextContent("2");
		expect(screen.getByRole("alert")).toHaveTextContent("invalid");
	});

	it("disables submission while a request is in flight", () => {
		render(
			<CreateTrekkingRouteForm
				campsites={campsites as never}
				isSubmitting
				error={null}
				onSubmit={vi.fn()}
				onRetry={vi.fn()}
			/>
		);
		expect(screen.getByRole("button", { name: /Đang tạo tuyến/ })).toBeDisabled();
	});
});
