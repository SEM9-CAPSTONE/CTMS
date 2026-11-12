import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { WeatherPenalty } from "../types";
import { WeatherPenaltiesPanel } from "./WeatherPenaltiesPanel";

function penalty(overrides: Partial<WeatherPenalty> = {}): WeatherPenalty {
	return {
		id: "p-1",
		tripId: "trip-1",
		tripTitle: "Tà Năng – Phan Dũng",
		tripStartsAt: "2030-01-10T01:00:00.000Z",
		hostId: "host-1",
		hostName: "Host A",
		violationNumber: 1,
		bookingValue: "20000000.00",
		ratePercent: 5,
		capAmount: "2000000.00",
		amount: "1000000.00",
		deductedAmount: "570000.00",
		outstandingAmount: "430000.00",
		status: "applied",
		hostingBlockedUntil: null,
		waiverDeadline: "2030-01-12T01:00:00.000Z",
		waiver: {
			reason: "Host nhập viện cấp cứu",
			evidenceUrls: ["https://cdn.example/weather-penalty-waivers/giay-vien.pdf"],
			requestedAt: "2030-01-10T05:00:00.000Z",
			reviewDueAt: "2099-01-17T05:00:00.000Z",
			decision: null,
			reviewedAt: null,
			reviewNote: null,
		},
		createdAt: "2030-01-09T20:00:00.000Z",
		...overrides,
	};
}

function service(items: WeatherPenalty[]) {
	return {
		listMine: vi.fn(),
		requestWaiver: vi.fn(),
		uploadEvidence: vi.fn(),
		listForAdmin: vi.fn().mockResolvedValue(items),
		getForAdmin: vi.fn(),
		reviewWaiver: vi.fn().mockImplementation(async (_id: string, input: { approve: boolean }) =>
			penalty({
				status: input.approve ? "waived" : "applied",
				deductedAmount: input.approve ? "0.00" : "570000.00",
				waiver: {
					...penalty().waiver,
					decision: input.approve ? "approved" : "rejected",
					reviewedAt: "2030-01-11T00:00:00.000Z",
					reviewNote: "Giấy viện hợp lệ",
				},
			})
		),
	} as unknown as typeof weatherPenaltiesService & Record<string, ReturnType<typeof vi.fn>>;
}

afterEach(() => vi.restoreAllMocks());

it("lists the waiver requests waiting first and switches filters", async () => {
	const api = service([penalty()]);
	render(<WeatherPenaltiesPanel service={api} />);
	const row = await screen.findByTestId("weather-penalty-row");
	expect(row).toHaveTextContent("Host Host A");
	expect(row).toHaveTextContent("Chờ duyệt miễn");
	expect(row).toHaveTextContent("Cần xem trước 17/01/2099");
	expect(api.listForAdmin).toHaveBeenCalledWith("waiver_pending");

	vi.mocked(api.listForAdmin).mockResolvedValue([]);
	fireEvent.click(screen.getByRole("tab", { name: "Đã miễn" }));
	expect(await screen.findByText("Chưa miễn khoản phạt nào.")).toBeVisible();
	expect(api.listForAdmin).toHaveBeenCalledWith("waived");
	fireEvent.click(screen.getByRole("tab", { name: "Tất cả" }));
	await waitFor(() => expect(api.listForAdmin).toHaveBeenCalledWith("all"));
});

it("flags a waiver request past its 5 working days", async () => {
	const api = service([
		penalty({ waiver: { ...penalty().waiver, reviewDueAt: "2020-01-01T00:00:00.000Z" } }),
	]);
	render(<WeatherPenaltiesPanel service={api} />);
	expect(await screen.findByTestId("weather-penalty-row")).toHaveTextContent("Quá hạn xem");
});

it("shows the evidence and approves the waiver with a mandatory note", async () => {
	const api = service([penalty()]);
	render(<WeatherPenaltiesPanel service={api} />);
	fireEvent.click(await screen.findByTestId("weather-penalty-row"));
	const dialog = await screen.findByTestId("admin-weather-penalty-dialog");
	expect(within(dialog).getByText("Host nhập viện cấp cứu")).toBeVisible();
	expect(within(dialog).getByRole("link", { name: "giay-vien.pdf" })).toHaveAttribute(
		"href",
		"https://cdn.example/weather-penalty-waivers/giay-vien.pdf"
	);
	fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt miễn phạt" }));
	expect(within(dialog).getByRole("alert")).toHaveTextContent("Hãy ghi lý do");
	fireEvent.change(within(dialog).getByLabelText("Lý do của bạn (bắt buộc)"), {
		target: { value: "Giấy viện hợp lệ" },
	});
	fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt miễn phạt" }));
	const confirm = await screen.findByTestId("confirm-modal");
	expect(confirm).toHaveTextContent(/570\.000/);
	fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận" }));
	await waitFor(() =>
		expect(api.reviewWaiver).toHaveBeenCalledWith("p-1", {
			approve: true,
			note: "Giấy viện hợp lệ",
		})
	);
	expect(await within(dialog).findByText(/Đã duyệt miễn/)).toBeVisible();
	expect(within(dialog).queryByRole("button", { name: "Duyệt miễn phạt" })).not.toBeInTheDocument();
	await waitFor(() => expect(api.listForAdmin).toHaveBeenCalledTimes(2));
});

it("rejects a waiver and has no review form when the Host has not asked", async () => {
	const api = service([
		penalty(),
		penalty({
			id: "p-2",
			tripTitle: "Bidoup",
			waiver: {
				...penalty().waiver,
				reason: null,
				evidenceUrls: [],
				requestedAt: null,
				reviewDueAt: null,
			},
		}),
	]);
	render(<WeatherPenaltiesPanel service={api} />);
	const rows = await screen.findAllByTestId("weather-penalty-row");
	fireEvent.click(rows[1]);
	let dialog = await screen.findByTestId("admin-weather-penalty-dialog");
	expect(within(dialog).getByText(/Host chưa xin miễn phạt/)).toBeVisible();
	expect(within(dialog).queryByRole("button", { name: "Từ chối" })).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole("button", { name: "Đóng" }));

	fireEvent.click(rows[0]);
	dialog = await screen.findByTestId("admin-weather-penalty-dialog");
	fireEvent.change(within(dialog).getByLabelText("Lý do của bạn (bắt buộc)"), {
		target: { value: "Thiếu bằng chứng" },
	});
	fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối" }));
	fireEvent.click(
		within(await screen.findByTestId("confirm-modal")).getByRole("button", { name: "Xác nhận" })
	);
	await waitFor(() =>
		expect(api.reviewWaiver).toHaveBeenCalledWith("p-1", {
			approve: false,
			note: "Thiếu bằng chứng",
		})
	);
	expect(await within(dialog).findByText(/Đã từ chối/)).toBeVisible();
});
