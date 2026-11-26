import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRouteSafety } from "../../route-safety/hooks/useRouteSafety";
import { useRouteTerrain } from "../../route-safety/hooks/useRouteTerrain";
import { RouteDirectionsError, fetchRouteDirections } from "../services/route-directions.service";
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
const toggle = () => fireEvent.click(screen.getByRole("switch", { name: "Tự động bám đường" }));
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

it("appends smart, manual, smart segments without changing earlier geometry and saves their boundaries", async () => {
	directions
		.mockResolvedValueOnce(line(a, firstBend, b))
		.mockResolvedValueOnce(line(c, lastBend, d));
	const submit = setup();
	fireEvent.change(screen.getByLabelText("Tên tuyến"), { target: { value: route.name } });
	fireEvent.change(screen.getByLabelText("Thời lượng dự kiến (phút)"), {
		target: { value: "120" },
	});
	expect(screen.getByRole("switch")).toBeChecked();
	mapClick(a);
	await settle();
	expect(directions).not.toHaveBeenCalled();
	mapClick(b);
	await settle();
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, firstBend, b), undefined);
	toggle();
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, firstBend, b), undefined);
	mapClick(c);
	await settle();
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, firstBend, b, c), undefined);
	expect(directions).toHaveBeenCalledTimes(1);
	toggle();
	mapClick(d);
	await settle();
	expect(directions).toHaveBeenNthCalledWith(1, [a, b], expect.any(AbortSignal));
	expect(directions).toHaveBeenNthCalledWith(2, [c, d], expect.any(AbortSignal));
	expect(directions).toHaveBeenCalledTimes(2);
	expect(useRouteTerrain).toHaveBeenLastCalledWith(hybrid, "120");
	expect(useRouteSafety).toHaveBeenLastCalledWith(hybrid, undefined);
	expect(screen.getAllByRole("button", { name: /Điểm trung gian/ })).toHaveLength(2);
	expect(screen.getByText(/Các đoạn vẽ thủ công chưa được đối chiếu/)).toBeInTheDocument();
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			geometry: hybrid,
			drawing: {
				mode: "hybrid",
				waypoints: [a, b, c, d],
				segments: [
					{ id: expect.any(String), mode: "smart", endIndex: 2 },
					{ id: expect.any(String), mode: "manual", endIndex: 3 },
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
	const marker = screen.getByRole("button", { name: "Điểm trung gian 1" });
	marker.setPointerCapture = vi.fn();
	directions.mockResolvedValueOnce(line(a, firstBend, moved));
	fireEvent.pointerDown(marker, { pointerId: 1 });
	fireEvent.pointerMove(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).not.toHaveBeenCalled();
	fireEvent.pointerUp(marker, { clientX: moved[0] + 180, clientY: 90 - moved[1] });
	await settle();
	expect(directions).toHaveBeenCalledExactlyOnceWith([a, moved], expect.any(AbortSignal));
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
	expect(directions).toHaveBeenCalledTimes(1);
});

it("asks how to reconnect a mixed junction and leaves the unrelated segment unchanged", async () => {
	setup(route);
	click("Điểm trung gian 1");
	click("Xóa điểm đã chọn");
	expect(screen.getByText(/Chọn cách nối hai điểm còn lại/)).toBeInTheDocument();
	click("Nối thủ công");
	await settle();
	expect(directions).not.toHaveBeenCalled();
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, c, lastBend, d), route.id);
	click("Xóa và vẽ lại");
	expect(screen.queryByRole("button", { name: "Điểm bắt đầu" })).not.toBeInTheDocument();
	click("Hoàn tác");
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(a, c, lastBend, d), route.id);
});

it("locks the shared snapped endpoint while updating two smart segments, even with the switch off", async () => {
	const metadata = route.drawing;
	if (metadata?.mode !== "hybrid") throw new Error("Expected hybrid fixture");
	setup({
		...route,
		drawing: {
			...metadata,
			segments: metadata.segments.map((segment) => ({ ...segment, mode: "smart" })),
		},
	});
	toggle();
	const snapped: Position = [107.591001, 16.462];
	directions
		.mockResolvedValueOnce(line(a, firstBend, snapped))
		.mockResolvedValueOnce(line(snapped, c));
	const marker = screen.getByRole("button", { name: "Điểm trung gian 1" });
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

it("rejects a disconnected snap, keeps the route and confirms a fallback only for the new segment", async () => {
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
	expect(screen.getByRole("alert")).toHaveTextContent("không nối đúng điểm");
	expect(directions).toHaveBeenLastCalledWith([d, endpoint], expect.any(AbortSignal));
	click("Vẽ thủ công đoạn này");
	click("Xác nhận nối thủ công");
	await settle();
	expect(screen.getByRole("switch")).toBeChecked();
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(...hybrid.coordinates, endpoint), route.id);
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			drawing: expect.objectContaining({
				segments: [
					{ id: "first", mode: "smart", endIndex: 2 },
					{ id: "second", mode: "manual", endIndex: 3 },
					{ id: "third", mode: "smart", endIndex: 5 },
					{ id: expect.any(String), mode: "manual", endIndex: 6 },
				],
			}),
		})
	);
});

it("ignores an obsolete response after selecting a different endpoint", async () => {
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
	await settle();
	expect(oldSignal.aborted).toBe(true);
	await act(async () => finishOld(line(d, oldEnd)));
	expect(useRouteSafety).toHaveBeenLastCalledWith(line(...hybrid.coordinates, nextEnd), route.id);
});

it("adds a short manual connection to a nearby mapped start only after confirmation", async () => {
	const submit = setup(route);
	const snappedStart: Position = [107.5941, 16.48];
	const bend: Position = [107.595, 16.481];
	const endpoint: Position = [107.598, 16.481];
	directions.mockResolvedValueOnce(line(snappedStart, bend, endpoint));
	mapClick(endpoint);
	await settle();
	expect(screen.getByRole("alert")).toHaveTextContent("không nối đúng điểm");
	click("Nối tới đường đi bộ");
	click("Xác nhận nối thủ công");
	await settle();
	const appended = line(...hybrid.coordinates, snappedStart, bend, endpoint);
	expect(useRouteSafety).toHaveBeenLastCalledWith(appended, route.id);
	expect(directions).toHaveBeenCalledTimes(1);
	await submitForm();
	expect(submit).toHaveBeenCalledWith(
		expect.objectContaining({
			geometry: appended,
			drawing: expect.objectContaining({
				segments: [
					{ id: "first", mode: "smart", endIndex: 2 },
					{ id: "second", mode: "manual", endIndex: 3 },
					{ id: "third", mode: "smart", endIndex: 5 },
					{ id: expect.any(String), mode: "manual", endIndex: 6 },
					{ id: expect.any(String), mode: "smart", endIndex: 8 },
				],
			}),
		})
	);
});
