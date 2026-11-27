import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useRouteTerrain } from "../../route-safety/hooks/useRouteTerrain";
import {
	RouteDirectionsError,
	RouteSnapDistanceError,
	fetchRouteDirections,
} from "../services/route-directions.service";
import type { CreatedTrekkingRoute, GeoJsonLineString, Position } from "../types";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";

vi.hoisted(() => vi.resetModules());
vi.mock("../services/route-directions.service", async (importOriginal) => ({
	...(await importOriginal<typeof import("../services/route-directions.service")>()),
	fetchRouteDirections: vi.fn(),
}));
vi.mock("../../route-safety/hooks/useRouteTerrain", () => ({ useRouteTerrain: vi.fn(() => ({})) }));
vi.mock("../../route-safety/hooks/useRouteSafety", () => ({ useRouteSafety: vi.fn(() => ({})) }));
vi.mock("../../route-safety/components/VerifiedDangerZonesLayer", () => ({
	VerifiedDangerZonesLayer: () => null,
}));

const a: Position = [107.579, 16.468];
const b: Position = [107.59, 16.463];
const c: Position = [107.592, 16.467];
const d: Position = [107.594, 16.48];
const moved: Position = [107.591, 16.462];
const firstBend: Position = [107.585, 16.468];
const lastBend: Position = [107.595, 16.475];
const line = (...coordinates: Position[]): GeoJsonLineString => ({
	type: "LineString",
	coordinates,
});
const hybrid = line(a, firstBend, b, c, lastBend, d);
const route: CreatedTrekkingRoute = {
	id: "saved",
	name: "Lối mòn ven hồ",
	description: null,
	geometry: hybrid,
	difficulty: "moderate",
	expectedDurationMinutes: 120,
	lengthMeters: 4000,
	status: "draft",
	createdAt: "2026-11-26",
	updatedAt: "2026-11-26",
	drawing: {
		mode: "hybrid",
		waypoints: [a, b, c, d],
		segments: [
			{ id: "first", mode: "smart", endIndex: 2 },
			{ id: "second", mode: "manual", endIndex: 3 },
			{ id: "third", mode: "smart", endIndex: 5 },
		],
	},
};
const directions = vi.mocked(fetchRouteDirections);
const mapClick = ([lng, lat]: Position) =>
	fireEvent.click(screen.getByRole("button", { name: "Bản đồ vẽ tuyến" }), {
		clientX: lng + 180,
		clientY: 90 - lat,
	});
const settle = () => act(() => vi.advanceTimersByTimeAsync(400));
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

function setup(existing?: CreatedTrekkingRoute) {
	const submit = vi.fn().mockResolvedValue(undefined);
	render(
		<CreateTrekkingRouteForm route={existing} isSubmitting={false} error={null} onSubmit={submit} />
	);
	const surface = screen.getByTestId("route-map-surface").firstElementChild;
	if (!surface) throw new Error("Missing map container");
	vi.spyOn(surface, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 360, 180));
	return submit;
}

async function submitForm() {
	const form = screen.getByTestId("route-map-surface").closest("form");
	if (!form) throw new Error("Missing route form");
	await act(async () => fireEvent.submit(form));
}

beforeEach(() => {
	vi.stubEnv("VITE_MAPTILER_API_KEY", "");
	vi.useFakeTimers();
	directions.mockReset();
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

it("routes each appended point in click order and saves the segment boundaries", async () => {
	directions
		.mockResolvedValueOnce(line(a, firstBend, b))
		.mockResolvedValueOnce(line(b, c))
		.mockResolvedValueOnce(line(c, lastBend, d));
	const submit = setup();
	fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: route.name } });
	fireEvent.change(screen.getByLabelText("Thời lượng dự kiến (phút)"), {
		target: { value: "120" },
	});
	expect(screen.queryByRole("switch")).not.toBeInTheDocument();
	mapClick(a);
	await settle();
	expect(directions).not.toHaveBeenCalled();
	mapClick(b);
	mapClick(c);
	mapClick(d);
	await settle();
	await settle();
	await settle();
	expect(directions).toHaveBeenNthCalledWith(1, [a, b], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(2, [b, c], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(3, [c, d], expect.any(AbortSignal));
	expect(directions).toHaveBeenCalledTimes(3);
	expect(useRouteTerrain).toHaveBeenLastCalledWith(hybrid, "120");
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, undefined);
	const drawingPoints = screen.getAllByRole("button", { name: /^Điểm vẽ \d+$/ });
	expect(drawingPoints).toHaveLength(4);
	expect(drawingPoints.every((point) => point.textContent === "")).toBe(true);
	expect(
		screen.queryByRole("button", { name: /Điểm bắt đầu|Điểm kết thúc|Điểm trung gian/ })
	).not.toBeInTheDocument();
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			geometry: hybrid,
			drawing: {
				mode: "hybrid",
				waypoints: [a, b, c, d],
				segments: [
					{ id: expect.any(String), mode: "smart", endIndex: 2 },
					{ id: expect.any(String), mode: "smart", endIndex: 3 },
					{ id: expect.any(String), mode: "smart", endIndex: 5 },
				],
			},
		})
	);
});

it("reopens a hybrid route, edits only its adjacent segments and undoes geometry and mode exactly", async () => {
	const submit = setup(route);
	await settle();
	expect(directions).not.toHaveBeenCalled();
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, route.id);
	const marker = screen.getByRole("button", { name: "Điểm vẽ 2" });
	marker.setPointerCapture = vi.fn();
	directions.mockResolvedValueOnce(line(a, firstBend, moved)).mockResolvedValueOnce(line(moved, c));
	fireEvent.pointerDown(marker, { pointerId: 1 });
	fireEvent.pointerMove(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).not.toHaveBeenCalled();
	fireEvent.pointerUp(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).toHaveBeenNthCalledWith(1, [a, moved], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(2, [moved, c], expect.any(AbortSignal));
	expect(useRouteSafety).toHaveBeenLastCalledWith(
		line(a, firstBend, moved, c, lastBend, d),
		route.id
	);
	click("Hoàn tác");
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, route.id);
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({ geometry: hybrid, drawing: route.drawing })
	);
	expect(directions).toHaveBeenCalledTimes(2);
});

it("reconnects a mixed junction by road and leaves the unrelated segment unchanged", async () => {
	setup(route);
	directions.mockResolvedValueOnce(line(a, c));
	click("Điểm vẽ 2");
	click("Xóa điểm đã chọn");
	await settle();
	expect(directions).toHaveBeenCalledExactlyOnceWith([a, c], expect.any(AbortSignal));
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, c, lastBend, d), route.id);
	click("Xóa và vẽ lại");
	expect(screen.queryByRole("button", { name: /^Điểm vẽ \d+$/ })).not.toBeInTheDocument();
	click("Hoàn tác");
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, c, lastBend, d), route.id);
});

it("locks the shared snapped endpoint while updating two segments", async () => {
	const metadata = route.drawing;
	if (metadata?.mode !== "hybrid") throw new Error("Expected hybrid fixture");
	setup({
		...route,
		drawing: {
			...metadata,
			segments: metadata.segments.map((segment) => ({ ...segment, mode: "smart" })),
		},
	});
	const snapped: Position = [107.591001, 16.462];
	directions
		.mockResolvedValueOnce(line(a, firstBend, snapped))
		.mockResolvedValueOnce(line(snapped, c));
	const marker = screen.getByRole("button", { name: "Điểm vẽ 2" });
	marker.setPointerCapture = vi.fn();
	fireEvent.pointerDown(marker, { pointerId: 1 });
	fireEvent.pointerUp(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).toHaveBeenNthCalledWith(1, [a, moved], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(2, [snapped, c], expect.any(AbortSignal));
	expect(directions).toHaveBeenCalledTimes(2);
	expect(useRouteSafety).toHaveBeenLastCalledWith(
		line(a, firstBend, snapped, c, lastBend, d),
		route.id
	);
});

it("rejects disconnected routing and keeps the existing route when the change is cancelled", async () => {
	const submit = setup(route);
	const endpoint: Position = [107.598, 16.481];
	directions.mockRejectedValueOnce(new RouteDirectionsError("Không tìm thấy đường đi bộ."));
	directions.mockResolvedValueOnce(line([107.5941, 16.48], endpoint));
	mapClick(endpoint);
	await settle();
	expect(screen.getByRole("alert")).toHaveTextContent("Không tìm thấy đường đi bộ.");
	expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
	click("Thử tìm đường lại");
	await settle();
	expect(screen.getByRole("alert")).toHaveTextContent("Chưa tìm được đường đi bộ nối liền");
	expect(directions).toHaveBeenLastCalledWith([d, endpoint], expect.any(AbortSignal));
	click("Bỏ thay đổi");
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, route.id);
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			drawing: route.drawing,
		})
	);
});

it("identifies the first drawing point and retries to the chosen destination when moved", async () => {
	directions
		.mockRejectedValueOnce(new RouteSnapDistanceError([0], 75))
		.mockResolvedValueOnce(line(moved, c));
	setup();
	mapClick(a);
	mapClick(c);
	await settle();
	expect(screen.getByRole("alert")).toHaveTextContent("Điểm vẽ 1 cách tuyến đi bộ");
	const marker = screen.getByRole("button", { name: "Điểm vẽ 1" });
	marker.setPointerCapture = vi.fn();
	fireEvent.pointerDown(marker, { pointerId: 1 });
	fireEvent.pointerUp(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).toHaveBeenLastCalledWith([moved, c], expect.any(AbortSignal));
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(moved, c), undefined);
});

it("shows the route point number for a remote snap when appending to an existing route", async () => {
	directions.mockRejectedValueOnce(new RouteSnapDistanceError([1], 75));
	setup(route);
	mapClick([107.598, 16.481]);
	await settle();
	expect(screen.getByRole("alert")).toHaveTextContent("Điểm vẽ 5 cách tuyến đi bộ");
	expect(screen.getAllByRole("button", { name: /^Điểm vẽ \d+$/ })).toHaveLength(4);
	click("Bỏ thay đổi");
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, route.id);
});

it("cancels pending points and ignores an obsolete response after undo", async () => {
	let finishOld: (value: GeoJsonLineString) => void = () => undefined;
	directions.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishOld = resolve;
			})
	);
	const oldEnd: Position = [107.598, 16.481];
	const nextEnd: Position = [107.599, 16.482];
	directions.mockResolvedValueOnce(line(d, nextEnd));
	setup(route);
	mapClick(oldEnd);
	await settle();
	const oldSignal = directions.mock.calls[0][1];
	mapClick(nextEnd);
	click("Hoàn tác");
	mapClick(nextEnd);
	await settle();
	expect(oldSignal.aborted).toBe(true);
	await act(async () => finishOld(line(d, oldEnd)));
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(...hybrid.coordinates, nextEnd), route.id);
});

it("inserts a movable point on the orange line without appending or requesting a new route", async () => {
	const submit = setup(route);
	fireEvent.click(screen.getByTestId("drawing-line"), {
		clientX: firstBend[0] + 180,
		clientY: 90 - firstBend[1],
	});
	expect(screen.getAllByRole("button", { name: /^Điểm vẽ \d+$/ })).toHaveLength(5);
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, route.id);
	expect(directions).not.toHaveBeenCalled();
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			geometry: hybrid,
			drawing: expect.objectContaining({
				waypoints: [a, firstBend, b, c, d],
				segments: [
					{ id: "first", mode: "smart", endIndex: 1 },
					{ id: expect.any(String), mode: "smart", endIndex: 2 },
					{ id: "second", mode: "manual", endIndex: 3 },
					{ id: "third", mode: "smart", endIndex: 5 },
				],
			}),
		})
	);
	const marker = screen.getByRole("button", { name: "Điểm vẽ 2" });
	marker.setPointerCapture = vi.fn();
	const adjustment: Position = [107.585, 16.469];
	directions.mockResolvedValueOnce(line(a, adjustment)).mockResolvedValueOnce(line(adjustment, b));
	fireEvent.pointerDown(marker, { pointerId: 1 });
	fireEvent.pointerUp(marker, { clientX: adjustment[0] + 180, clientY: 90 - adjustment[1] });
	await settle();
	expect(directions).toHaveBeenNthCalledWith(1, [a, adjustment], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(2, [adjustment, b], expect.any(AbortSignal));
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, adjustment, b, c, lastBend, d), route.id);
});
