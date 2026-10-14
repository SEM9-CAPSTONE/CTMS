import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { AvailablePortersResponse, PorterRequest } from "../types";
import { AvailablePortersPanel } from "./AvailablePortersPanel";

const SUPPORT_RESPONSE: AvailablePortersResponse = {
	items: [
		{
			porterId: "porter-private-id",
			displayName: "Nguyễn Minh Sơn",
			experienceYears: 6,
			availabilityStatus: "available",
			ratingAvg: 4.75,
			completedTrips: 18,
		},
	],
	pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

const PORTER_REQUEST: PorterRequest = {
	id: "request-1",
	tripId: "trip-201",
	porterId: "porter-private-id",
	requestedBy: "host-1",
	requestedRole: "support",
	note: "Support river crossing",
	status: "pending",
	expiresAt: "2035-07-10T08:00:00.000Z",
	respondedAt: null,
	createdAt: "2035-07-08T08:00:00.000Z",
	updatedAt: "2035-07-08T08:00:00.000Z",
};

function renderPanel() {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } },
	});
	function Wrapper({ children }: { children: ReactNode }) {
		return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
	}
	return render(<AvailablePortersPanel tripId="trip-201" />, { wrapper: Wrapper });
}

function selectRole(role: "lead" | "support") {
	fireEvent.change(screen.getByLabelText("Vai trò Porter"), { target: { value: role } });
}

afterEach(() => vi.restoreAllMocks());

describe("AvailablePortersPanel", () => {
	it("requires an explicit role before fetching", () => {
		const search = vi.spyOn(tripsService, "getAvailablePorters");
		renderPanel();
		expect(screen.getByText("Chọn vai trò để bắt đầu tìm Porter.")).toBeInTheDocument();
		expect(search).not.toHaveBeenCalled();
	});

	it("shows loading, operational fields, and no private or internal identifier", async () => {
		let resolveRequest: ((value: AvailablePortersResponse) => void) | undefined;
		vi.spyOn(tripsService, "getAvailablePorters").mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve;
			})
		);
		renderPanel();
		selectRole("support");
		expect(screen.getByRole("status")).toHaveTextContent("Đang kiểm tra Porter phù hợp");
		resolveRequest?.(SUPPORT_RESPONSE);

		await screen.findByText("Nguyễn Minh Sơn");
		expect(screen.getByText("6 năm")).toBeInTheDocument();
		expect(screen.getByText("4.8")).toBeInTheDocument();
		expect(screen.getByText("18 chuyến")).toBeInTheDocument();
		expect(screen.queryByText("porter-private-id")).not.toBeInTheDocument();
		expect(screen.queryByText(/@/)).not.toBeInTheDocument();
	});

	it("shows exact-Route proficiency only for lead results", async () => {
		vi.spyOn(tripsService, "getAvailablePorters").mockResolvedValue({
			items: [{ ...SUPPORT_RESPONSE.items[0], proficiency: "expert" }],
			pagination: SUPPORT_RESPONSE.pagination,
		});
		renderPanel();
		selectRole("lead");
		expect(await screen.findByText("Chuyên gia")).toBeInTheDocument();
	});

	it("renders an empty result as a valid state", async () => {
		vi.spyOn(tripsService, "getAvailablePorters").mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});
		renderPanel();
		selectRole("support");
		expect(await screen.findByTestId("available-porters-empty")).toHaveTextContent(
			"Không có Porter phù hợp"
		);
	});

	it.each([
		[403, "forbidden"],
		[404, "notFound"],
		[422, "validation"],
	] as const)("renders the mapped %s blocked state", async (status, kind) => {
		vi.spyOn(tripsService, "getAvailablePorters").mockRejectedValue(
			new HttpError("private backend detail", status, {})
		);
		renderPanel();
		selectRole("support");
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveAttribute("data-error-kind", kind);
		expect(alert).not.toHaveTextContent("private backend detail");
	});

	it("retries a retryable backend failure against the service", async () => {
		const search = vi
			.spyOn(tripsService, "getAvailablePorters")
			.mockRejectedValueOnce(new HttpError("unavailable", 503, {}))
			.mockRejectedValueOnce(new HttpError("unavailable", 503, {}))
			.mockResolvedValueOnce(SUPPORT_RESPONSE);
		renderPanel();
		selectRole("support");
		const retry = await screen.findByRole("button", { name: "Thử lại" });
		fireEvent.click(retry);
		expect(await screen.findByText("Nguyễn Minh Sơn")).toBeInTheDocument();
		expect(search).toHaveBeenCalledTimes(3);
	});

	it("prevents invalid experience requests and resets pagination when filters change", async () => {
		const search = vi
			.spyOn(tripsService, "getAvailablePorters")
			.mockImplementation(async (_tripId, query) => ({
				items: SUPPORT_RESPONSE.items,
				pagination: { page: query.page, limit: query.limit, total: 21, totalPages: 2 },
			}));
		renderPanel();
		selectRole("support");
		await screen.findByText("Nguyễn Minh Sơn");
		fireEvent.click(screen.getByRole("button", { name: "Tiếp theo" }));
		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith("trip-201", expect.objectContaining({ page: 2 }))
		);

		fireEvent.change(screen.getByLabelText("Kinh nghiệm tối thiểu (năm)"), {
			target: { value: "4" },
		});
		await waitFor(() =>
			expect(search).toHaveBeenLastCalledWith(
				"trip-201",
				expect.objectContaining({ minExperienceYears: 4, page: 1 })
			)
		);

		const callsBeforeInvalidInput = search.mock.calls.length;
		fireEvent.change(screen.getByLabelText("Kinh nghiệm tối thiểu (năm)"), {
			target: { value: "-1" },
		});
		expect(screen.getByText(/số nguyên từ 0 trở lên/)).toBeInTheDocument();
		expect(search).toHaveBeenCalledTimes(callsBeforeInvalidInput);
	});

	it("submits a Porter Request and renders only the backend-confirmed pending state", async () => {
		vi.spyOn(tripsService, "getAvailablePorters").mockResolvedValue(SUPPORT_RESPONSE);
		let resolveRequest: ((value: PorterRequest) => void) | undefined;
		const create = vi.spyOn(tripsService, "createPorterRequest").mockReturnValue(
			new Promise((resolve) => {
				resolveRequest = resolve;
			})
		);
		renderPanel();
		selectRole("support");
		await screen.findByText("Nguyễn Minh Sơn");
		fireEvent.change(screen.getByLabelText("Ghi chú yêu cầu"), {
			target: { value: " Support river crossing " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

		await waitFor(() => expect(screen.getByRole("button", { name: "Đang gửi" })).toBeDisabled());
		expect(screen.queryByText("Đang chờ phản hồi")).not.toBeInTheDocument();
		expect(create).toHaveBeenCalledWith("trip-201", {
			porterId: "porter-private-id",
			requestedRole: "support",
			note: "Support river crossing",
		});

		resolveRequest?.(PORTER_REQUEST);
		const state = await screen.findByTestId("porter-request-state-porter-private-id");
		expect(state).toHaveTextContent("Đang chờ phản hồi");
		expect(state).toHaveTextContent("Hết hạn:");
		expect(screen.getByRole("button", { name: "Đã gửi yêu cầu" })).toBeDisabled();
	});

	it("does not fabricate request success when the backend rejects the request", async () => {
		vi.spyOn(tripsService, "getAvailablePorters").mockResolvedValue(SUPPORT_RESPONSE);
		vi.spyOn(tripsService, "createPorterRequest").mockRejectedValue(
			new HttpError("private conflict detail", 409, {})
		);
		renderPanel();
		selectRole("support");
		await screen.findByText("Nguyễn Minh Sơn");
		fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveAttribute("data-error-kind", "conflict");
		expect(alert).not.toHaveTextContent("private conflict detail");
		expect(screen.queryByText("Đang chờ phản hồi")).not.toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Gửi yêu cầu" })).not.toBeDisabled();
	});
});
