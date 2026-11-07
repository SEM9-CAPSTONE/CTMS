import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import type { MemberLocationsService } from "../services/member-locations.service";
import type { MemberLocation, TripMemberLocations } from "../types";
import { MemberLastLocationsCard } from "./MemberLastLocationsCard";

const TRIP_ID = "66666666-6666-4666-8666-666666666666";
const NOW = new Date("2026-11-07T03:12:00.000Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

const baseLocation = {
	id: "g",
	latitude: 16.04,
	longitude: 108.2,
	accuracyMeters: 8,
	eventTime: ago(30),
	receivedAt: ago(25),
};

function member(overrides: Partial<MemberLocation> = {}): MemberLocation {
	return {
		id: "m",
		userId: "u",
		name: "Camper",
		role: "camper",
		memberStatus: "joined",
		location: baseLocation,
		lastSeenAt: ago(30),
		lastSyncedAt: ago(25),
		freshness: "fresh",
		locationAgeSeconds: 30,
		safety: { route: null, gps: null, lastCheckpoint: null, behindSchedule: null },
		...overrides,
	};
}

function response(members: MemberLocation[] = []): TripMemberLocations {
	return {
		tripId: TRIP_ID,
		tripStatus: "ongoing",
		viewer: "host",
		generatedAt: NOW.toISOString(),
		locationSource: "server_confirmed",
		freshnessMaxAgeSeconds: 120,
		members,
	};
}

function renderCard(get: MemberLocationsService["get"], now: () => Date = () => NOW) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(<MemberLastLocationsCard tripId={TRIP_ID} service={{ get }} now={now} />, {
		wrapper,
	});
}

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("MemberLastLocationsCard (CTMS-066-T02)", () => {
	it("shows a loading state and says the data is not live", () => {
		renderCard(() => new Promise(() => undefined));
		expect(screen.getByText("Đang tải vị trí thành viên…")).toBeInTheDocument();
		expect(
			screen.getByText(/Vị trí server đã nhận gần nhất, không phải vị trí trực tiếp/)
		).toBeInTheDocument();
	});

	it("orders members by attention needed and shows last seen, coordinates, checkpoint and flags", async () => {
		renderCard(async () =>
			response([
				member({ id: "a", name: "An Mới" }),
				member({
					id: "p",
					name: "Porter Cũ",
					role: "porter",
					memberStatus: null,
					lastSeenAt: ago(900),
					location: { ...baseLocation, eventTime: ago(900) },
				}),
				member({ id: "n", name: "Nam Chưa", location: null, lastSeenAt: null, lastSyncedAt: null }),
				member({
					id: "b",
					name: "Bình Lệch",
					safety: {
						route: { type: "OFF_ROUTE", eventTime: ago(60), receivedAt: ago(50) },
						gps: null,
						lastCheckpoint: {
							checkpointId: "cp",
							checkpointName: "Đèo Gió",
							arrivedAt: ago(1200),
							receivedAt: ago(1190),
						},
						behindSchedule: {
							status: "BEHIND",
							lagMinutes: 35,
							reference: null,
							safeCheckpoint: null,
							evaluatedAt: NOW.toISOString(),
						},
					},
				}),
			])
		);
		const rows = await screen.findAllByTestId("member-location");
		expect(rows.map((row) => row.getAttribute("data-freshness"))).toEqual([
			"fresh",
			"stale",
			"unavailable",
			"fresh",
		]);
		expect(rows[0]).toHaveTextContent("Bình Lệch");
		expect(within(rows[0]).getByText("Lệch tuyến")).toBeInTheDocument();
		expect(within(rows[0]).getByText("Chậm hơn đoàn · 35 phút")).toBeInTheDocument();
		expect(rows[0]).toHaveTextContent("Checkpoint gần nhất: Đèo Gió");
		expect(rows[0]).toHaveTextContent("16.04000, 108.20000 · ±8 m");
		expect(rows[1]).toHaveTextContent("Porter Cũ");
		expect(within(rows[1]).getByText("Cũ")).toBeInTheDocument();
		expect(rows[1]).toHaveTextContent("15 phút trước");
		expect(within(rows[2]).getByText("Chưa có dữ liệu")).toBeInTheDocument();
		expect(rows[2]).toHaveTextContent("Server chưa nhận được vị trí nào của thành viên này.");
		expect(rows[2]).toHaveTextContent("Đồng bộ gần nhất: —");
		expect(within(rows[3]).getByText("Mới")).toBeInTheDocument();
		expect(rows[3]).toHaveTextContent("vừa xong");
	});

	it("never calls a future-dated capture fresh and marks members who left", async () => {
		renderCard(async () =>
			response([member({ lastSeenAt: ago(-120), memberStatus: "left", name: "Lan" })])
		);
		const [row] = await screen.findAllByTestId("member-location");
		expect(row).toHaveAttribute("data-freshness", "stale");
		expect(within(row).getByText("Đã rời đoàn")).toBeInTheDocument();
	});

	it("turns a fresh position stale as time passes without a new fetch", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		let clock = NOW;
		renderCard(
			async () => response([member({ lastSeenAt: ago(100) })]),
			() => clock
		);
		const [row] = await screen.findAllByTestId("member-location");
		expect(row).toHaveAttribute("data-freshness", "fresh");
		clock = new Date(NOW.getTime() + 30_000);
		await act(async () => {
			vi.advanceTimersByTime(15_000);
		});
		expect(screen.getByTestId("member-location")).toHaveAttribute("data-freshness", "stale");
	});

	it("shows an empty state", async () => {
		renderCard(async () => response([]));
		expect(
			await screen.findByText("Chuyến đi chưa có thành viên nào để theo dõi.")
		).toBeInTheDocument();
	});

	it.each([
		[403, "Bạn không có quyền xem vị trí thành viên của chuyến này."],
		[404, "Bạn không có quyền xem vị trí thành viên của chuyến này."],
		[409, "Chuyến đi không còn diễn ra nên không theo dõi vị trí."],
		[500, "Không tải được vị trí thành viên."],
	])("explains a %i response", async (status, text) => {
		renderCard(async () => {
			throw new HttpError("failed", status, null);
		});
		expect(await screen.findByRole("alert")).toHaveTextContent(text);
	});

	it("retries, and keeps the last data marked as such when a refresh fails", async () => {
		const get = vi
			.fn<MemberLocationsService["get"]>()
			.mockResolvedValueOnce(response([member({ name: "An" })]))
			.mockRejectedValueOnce(new HttpError("down", 503, null));
		renderCard(get);
		await screen.findByText("An");
		await userEvent.click(screen.getByRole("button", { name: "Làm mới" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			/Không cập nhật được vị trí\. Đang hiển thị dữ liệu lúc/
		);
		expect(screen.getByText("An")).toBeInTheDocument();
		expect(get).toHaveBeenCalledTimes(2);
	});
});
