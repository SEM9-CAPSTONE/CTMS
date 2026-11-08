import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api/httpClient";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import type { EmergencyBroadcastsService } from "../services/emergency-broadcasts.service";
import type { EmergencyBroadcast } from "../types";
import { HostEmergencyBroadcastCard } from "./HostEmergencyBroadcastCard";

const TRIP_ID = "trip-1";

function broadcast(overrides: Partial<EmergencyBroadcast> = {}): EmergencyBroadcast {
	return {
		id: "b-1",
		tripId: TRIP_ID,
		hostId: "host-1",
		alertType: "severe_weather",
		content: "Mưa lớn, dừng tại điểm nghỉ.",
		recipientCount: 3,
		createdAt: "2026-11-08T03:00:00.000Z",
		...overrides,
	};
}

let fake: ReturnType<typeof createFakeConnection>;

function renderCard(service: EmergencyBroadcastsService) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return render(
		<HostEmergencyBroadcastCard tripId={TRIP_ID} service={service} connection={fake.connection} />,
		{ wrapper }
	);
}

function fillForm(type = "evacuation", content = "  Cả đoàn quay về điểm xuất phát.  ") {
	fireEvent.change(screen.getByLabelText("Loại cảnh báo"), { target: { value: type } });
	fireEvent.change(screen.getByLabelText("Nội dung và hướng dẫn"), { target: { value: content } });
}

async function submitAndConfirm() {
	fireEvent.click(screen.getByRole("button", { name: /Phát cảnh báo|Gửi lại/ }));
	const modal = await screen.findByTestId("confirm-modal");
	fireEvent.click(
		Array.from(modal.querySelectorAll("button")).find(
			(b) => b.textContent === "Phát cảnh báo"
		) as HTMLElement
	);
}

beforeEach(() => {
	localStorage.setItem("accessToken", "host-token");
	fake = createFakeConnection();
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe("HostEmergencyBroadcastCard", () => {
	it("lists what was already broadcast with type, content and recipient count", async () => {
		renderCard({ list: vi.fn().mockResolvedValue([broadcast()]), create: vi.fn() });

		const item = await screen.findByTestId("host-emergency-broadcast-item");
		expect(item).toHaveTextContent("Thời tiết nguy hiểm");
		expect(item).toHaveTextContent("Mưa lớn, dừng tại điểm nghỉ.");
		expect(item).toHaveTextContent("3 người nhận");
	});

	it("requires a type and non-blank content before asking for confirmation", async () => {
		const create = vi.fn();
		renderCard({ list: vi.fn().mockResolvedValue([]), create });
		await screen.findByText("Chưa phát cảnh báo nào cho chuyến này.");

		fireEvent.change(screen.getByLabelText("Nội dung và hướng dẫn"), { target: { value: "   " } });
		fireEvent.click(screen.getByRole("button", { name: "Phát cảnh báo" }));

		expect(screen.getByText("Chọn loại cảnh báo.")).toBeInTheDocument();
		expect(screen.getByText("Nhập nội dung cảnh báo.")).toBeInTheDocument();
		expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
		expect(create).not.toHaveBeenCalled();
	});

	it("blocks content over 1000 characters", async () => {
		renderCard({ list: vi.fn().mockResolvedValue([]), create: vi.fn() });
		fillForm("other", "a".repeat(1001));
		fireEvent.click(screen.getByRole("button", { name: "Phát cảnh báo" }));
		expect(screen.getByText("Nội dung tối đa 1000 ký tự.")).toBeInTheDocument();
		expect(screen.getByTestId("emergency-content-counter")).toHaveTextContent("1001/1000");
		expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
	});

	it("sends trimmed content only after confirmation and shows who it reached", async () => {
		const create = vi.fn().mockImplementation(async (_tripId, input) =>
			broadcast({
				id: input.id,
				alertType: input.alertType,
				content: input.content,
				recipientCount: 4,
			})
		);
		renderCard({
			list: vi
				.fn()
				.mockResolvedValueOnce([])
				.mockResolvedValue([broadcast({ alertType: "evacuation" })]),
			create,
		});
		fillForm();

		fireEvent.click(screen.getByRole("button", { name: "Phát cảnh báo" }));
		expect(await screen.findByTestId("confirm-modal")).toHaveTextContent("Sơ tán");
		expect(create).not.toHaveBeenCalled();
		fireEvent.click(screen.getAllByRole("button", { name: "Phát cảnh báo" })[1]);

		expect(await screen.findByText("Đã phát cảnh báo tới 4 người.")).toBeInTheDocument();
		expect(create).toHaveBeenCalledWith(TRIP_ID, {
			id: expect.stringMatching(/^[0-9a-f-]{36}$/),
			alertType: "evacuation",
			content: "Cả đoàn quay về điểm xuất phát.",
		});
		expect(screen.getByLabelText("Nội dung và hướng dẫn")).toHaveValue("");
		expect(await screen.findByTestId("host-emergency-broadcast-item")).toHaveTextContent("Sơ tán");
	});

	it("resends the same broadcast ID after a network failure, so no duplicate is created", async () => {
		const create = vi
			.fn()
			.mockRejectedValueOnce(new TypeError("Failed to fetch"))
			.mockImplementation(async (_tripId, input) => broadcast({ id: input.id }));
		renderCard({ list: vi.fn().mockResolvedValue([]), create });
		fillForm();

		await submitAndConfirm();
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"hệ thống sẽ không tạo cảnh báo trùng"
		);
		await submitAndConfirm();

		await screen.findByText("Đã phát cảnh báo tới 3 người.");
		expect(create).toHaveBeenCalledTimes(2);
		expect(create.mock.calls[1][1].id).toBe(create.mock.calls[0][1].id);
	});

	it("uses a new ID for the next broadcast after a success", async () => {
		const create = vi
			.fn()
			.mockImplementation(async (_tripId, input) => broadcast({ id: input.id }));
		renderCard({ list: vi.fn().mockResolvedValue([]), create });
		fillForm();
		await submitAndConfirm();
		await screen.findByText("Đã phát cảnh báo tới 3 người.");
		fillForm("medical", "Một thành viên cần hỗ trợ y tế.");
		await submitAndConfirm();
		await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
		expect(create.mock.calls[1][1].id).not.toBe(create.mock.calls[0][1].id);
	});

	it.each([
		[
			new HttpError("x", 409, { code: "TRIP_NOT_BROADCASTABLE" }),
			"Chỉ phát cảnh báo được cho chuyến đang mở bán hoặc đang diễn ra.",
		],
		[
			new HttpError("x", 409, { code: "BROADCAST_ID_CONFLICT" }),
			"Bản nháp này đã được dùng cho một cảnh báo khác.",
		],
		[new HttpError("x", 404, {}), "Bạn không quản lý chuyến đi này nên không thể phát cảnh báo."],
		[new HttpError("x", 422, {}), "Nội dung cảnh báo không hợp lệ."],
	])("explains API rejection %#", async (error, message) => {
		renderCard({ list: vi.fn().mockResolvedValue([]), create: vi.fn().mockRejectedValue(error) });
		fillForm();
		await submitAndConfirm();
		expect(await screen.findByRole("alert")).toHaveTextContent(message);
	});

	it("starts a fresh draft ID when the Host asks for a new draft after a conflict", async () => {
		const create = vi
			.fn()
			.mockRejectedValueOnce(new HttpError("x", 409, { code: "BROADCAST_ID_CONFLICT" }))
			.mockImplementation(async (_tripId, input) => broadcast({ id: input.id }));
		renderCard({ list: vi.fn().mockResolvedValue([]), create });
		fillForm();
		await submitAndConfirm();
		await screen.findByRole("alert");
		fireEvent.click(screen.getByRole("button", { name: "Tạo bản nháp mới" }));
		await submitAndConfirm();
		await screen.findByText("Đã phát cảnh báo tới 3 người.");
		expect(create.mock.calls[1][1].id).not.toBe(create.mock.calls[0][1].id);
	});

	it("refreshes the history when a broadcast for this Trip arrives from another session", async () => {
		const list = vi
			.fn()
			.mockResolvedValueOnce([])
			.mockResolvedValue([broadcast({ id: "b-2", content: "Gửi từ máy khác" })]);
		renderCard({ list, create: vi.fn() });
		await screen.findByText("Chưa phát cảnh báo nào cho chuyến này.");

		act(() =>
			fake.latest().serverEmit("emergency.broadcast", { eventId: "x", tripId: "other-trip" })
		);
		expect(list).toHaveBeenCalledTimes(1);
		act(() => fake.latest().serverEmit("emergency.broadcast", { eventId: "b-2", tripId: TRIP_ID }));

		expect(await screen.findByText("Gửi từ máy khác")).toBeInTheDocument();
	});
});
