import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { API_ENDPOINTS, httpClient } from "../../../core/api";
import {
	EMPTY_SAFETY_COLLECTION,
	SAFETY_DEBOUNCE_MS,
	SAFETY_PROVIDERS,
} from "../../route-safety/constants";
import { TERRAIN_DEBOUNCE_MS } from "../../route-safety/terrain-constants";
import { approximateLengthMeters } from "../utils/route-import";
import { CreateTrekkingRouteForm } from "./CreateTrekkingRouteForm";

vi.mock("../hooks/useRouteMapSurface", async () => {
	const { useRef } = await import("react");
	return {
		useRouteMapSurface: () => ({
			containerRef: useRef<HTMLDivElement>(null),
			map: null,
			mapReady: false,
			fallback: true,
		}),
	};
});
vi.mock("../../route-safety/components/VerifiedDangerZonesLayer", () => ({
	VerifiedDangerZonesLayer: () => null,
}));

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	localStorage.removeItem("authUser");
});

it("sends the decoded MapTiler line to terrain and each safety provider, and measures its bends", async () => {
	vi.useFakeTimers();
	vi.stubEnv("VITE_MAPTILER_API_KEY", "unit-test");
	localStorage.setItem("authUser", JSON.stringify({ id: "host" }));
	const start = [107.579, 16.468] as [number, number];
	const end = [107.58, 16.468] as [number, number];
	const routed = {
		type: "LineString",
		coordinates: [start, [107.5793, 16.4684], end],
	};
	const safetyEndpoint = API_ENDPOINTS.ROUTE_SAFETY.ANALYZE;
	const terrainEndpoint = API_ENDPOINTS.ROUTE_SAFETY.TERRAIN;
	const post = vi
		.spyOn(httpClient, "post")
		.mockImplementation(async (endpoint) =>
			endpoint === terrainEndpoint
				? { status: "UNAVAILABLE" }
				: { features: EMPTY_SAFETY_COLLECTION }
		);
	let completeRouting: (response: Response) => void = () => undefined;
	const fetchDirections = vi.fn(
		() =>
			new Promise<Response>((resolve) => {
				completeRouting = resolve;
			})
	);
	vi.stubGlobal("fetch", fetchDirections);
	const client = new QueryClient();
	const view = render(
		<QueryClientProvider client={client}>
			<CreateTrekkingRouteForm isSubmitting={false} error={null} onSubmit={vi.fn()} />
		</QueryClientProvider>
	);
	const mapContainer = screen.getByTestId("route-map-surface").firstElementChild;
	if (!mapContainer) throw new Error("Missing map container");
	vi.spyOn(mapContainer, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 360, 180));
	const mapButton = screen.getByRole("button", { name: "Bản đồ vẽ tuyến" });
	for (const [lng, lat] of [start, end]) {
		fireEvent.click(mapButton, { clientX: lng + 180, clientY: 90 - lat });
	}
	await act(() => vi.advanceTimersByTimeAsync(TERRAIN_DEBOUNCE_MS));
	expect(fetchDirections).toHaveBeenCalledTimes(1);
	expect(post).not.toHaveBeenCalled();

	await act(async () =>
		completeRouting(
			Response.json({
				route: { legs: [{ geometry: "_acl^ofbelE_XwQ~Wwj@" }] },
			})
		)
	);
	await act(() => vi.advanceTimersByTimeAsync(SAFETY_DEBOUNCE_MS - 1));
	expect(post).not.toHaveBeenCalled();
	await act(() => vi.advanceTimersByTimeAsync(TERRAIN_DEBOUNCE_MS));

	expect(post.mock.calls.map(([endpoint, body]) => [endpoint, body])).toEqual(
		expect.arrayContaining([
			[terrainEndpoint, { geometry: routed }],
			...SAFETY_PROVIDERS.map((source) => [safetyEndpoint, { source, geometry: routed }]),
		])
	);
	expect(post).toHaveBeenCalledTimes(1 + SAFETY_PROVIDERS.length);
	const chordMeters = approximateLengthMeters([start, end]).toFixed(0);
	expect(screen.getByTestId("preview-length")).toHaveTextContent("142 m");
	expect(screen.getByTestId("preview-length")).not.toHaveTextContent(`${chordMeters} m`);

	post.mockClear();
	const nextEnd = [107.5803, 16.4683];
	fireEvent.click(mapButton, { clientX: nextEnd[0] + 180, clientY: 90 - nextEnd[1] });
	await act(() => vi.advanceTimersByTimeAsync(400));
	await act(async () =>
		completeRouting(Response.json({ route: { legs: [{ geometry: [end, nextEnd] }] } }))
	);
	await act(() => vi.advanceTimersByTimeAsync(TERRAIN_DEBOUNCE_MS));
	const extended = { type: "LineString", coordinates: [...routed.coordinates, nextEnd] };
	expect(fetchDirections).toHaveBeenCalledTimes(2);
	expect(post.mock.calls.map(([endpoint, body]) => [endpoint, body])).toEqual(
		expect.arrayContaining([
			[terrainEndpoint, { geometry: extended }],
			...SAFETY_PROVIDERS.map((source) => [safetyEndpoint, { source, geometry: extended }]),
		])
	);
	view.unmount();
	client.clear();
});
