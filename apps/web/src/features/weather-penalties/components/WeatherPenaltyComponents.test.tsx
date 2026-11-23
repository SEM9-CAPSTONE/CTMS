import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { createFakeConnection } from "../../../core/realtime/fakeRealtimeSocket.test-utils";
import type { weatherPenaltiesService } from "../services/weather-penalties.service";
import type { MyWeatherPenalties, WeatherPenalty } from "../types";
import { hostingBlockedMessage } from "../utils/weather-penalty-labels";
import { HostWeatherPenaltiesCard } from "./HostWeatherPenaltiesCard";

vi.mock("../../auth/utils/tokenStorage", () => ({ getStoredAuthUser: () => ({ id: "host-1" }) }));

const NOW = new Date("2030-01-11T03:00:00.000Z");

function penalty(overrides: Partial<WeatherPenalty> = {}): WeatherPenalty {
	return {
		id: "p-1",
		tripId: "trip-1",
		tripTitle: "Tà Năng – Phan Dũng",
		tripStartsAt: "2030-01-10T01:00:00.000Z",
		hostId: "host-1",
		hostName: "Host A",
		violationNumber: 2,
		bookingValue: "10000000.00",
		ratePercent: 10,
		capAmount: "5000000.00",
		amount: "1000000.00",
		deductedAmount: "0.00",
		outstandingAmount: "1000000.00",
		payment: {
			dueAt: "2030-01-16T20:00:00.000Z",
			overdue: false,
			collectedAmount: "0.00",
			collectedAt: null,
			reference: null,
			note: null,
		},
		status: "applied",
		hostingBlockedUntil: "2030-01-24T01:00:00.000Z",
		waiverDeadline: "2030-01-12T01:00:00.000Z",
		waiver: {
			reason: null,
			evidenceUrls: [],
			requestedAt: null,
			reviewDueAt: null,
			decision: null,
			reviewedAt: null,
			reviewNote: null,
		},
		createdAt: "2030-01-09T20:00:00.000Z",
		...overrides,
	};
}

function mine(overrides: Partial<MyWeatherPenalties> = {}): MyWeatherPenalties {
	return {
		items: [penalty()],
		outstandingTotal: "1000000.00",
		overdueTotal: "0.00",
		hostingBlockedUntil: "2030-01-24T01:00:00.000Z",
		suspended: false,
		paymentAccount: {
			bankName: "Vietcombank",
			accountNumber: "1028374659",
			accountHolderName: "CONG TY TNHH CTMS VIET NAM",
		},
		...overrides,
	};
}

function service(overrides: Partial<typeof weatherPenaltiesService> = {}) {
	return {
		listMine: vi.fn().mockResolvedValue(mine()),
		requestWaiver: vi.fn().mockResolvedValue(penalty()),
		uploadEvidence: vi
			.fn()
			.mockImplementation(async (file: File) => ({ url: `https://cdn.example/${file.name}` })),
		listForAdmin: vi.fn(),
		getForAdmin: vi.fn(),
		reviewWaiver: vi.fn(),
		...overrides,
	} as unknown as typeof weatherPenaltiesService & Record<string, ReturnType<typeof vi.fn>>;
}

function renderCard(api: ReturnType<typeof service>, connection = createFakeConnection()) {
	render(
		<HostWeatherPenaltiesCard service={api} connection={connection.connection} now={() => NOW} />
	);
	return connection;
}

function pdf(name: string, size = 1000, type = "application/pdf") {
	const file = new File(["%PDF"], name, { type });
	Object.defineProperty(file, "size", { value: size });
	return file;
}

beforeEach(() => localStorage.setItem("accessToken", "test-token"));
afterEach(() => {
	localStorage.removeItem("accessToken");
	vi.restoreAllMocks();
});

describe("HostWeatherPenaltiesCard", () => {
	it("stays hidden when the Host has no weather penalty", async () => {
		const api = service({
			listMine: vi
				.fn()
				.mockResolvedValue(
					mine({ items: [], outstandingTotal: "0.00", hostingBlockedUntil: null })
				),
		});
		renderCard(api);
		await waitFor(() => expect(api.listMine).toHaveBeenCalled());
		expect(screen.queryByTestId("host-weather-penalties-card")).not.toBeInTheDocument();
	});

	it("shows the debt, the hosting block and each penalty with its status", async () => {
		const api = service({
			listMine: vi.fn().mockResolvedValue(
				mine({
					items: [
						penalty(),
						penalty({
							id: "p-0",
							tripTitle: "Bidoup",
							violationNumber: 1,
							status: "waived",
							outstandingAmount: "0.00",
							hostingBlockedUntil: null,
							waiver: {
								...penalty().waiver,
								requestedAt: "2030-01-02T00:00:00.000Z",
								decision: "approved",
								reviewNote: "Giấy viện hợp lệ",
							},
						}),
					],
				})
			),
		});
		renderCard(api);
		expect(await screen.findByTestId("weather-penalty-outstanding")).toHaveTextContent(
			/1\.000\.000/
		);
		expect(screen.getByTestId("weather-penalty-hosting-block")).toHaveTextContent(
			"Bạn đang bị khoá tạo Trip mới đến 24/01/2030"
		);
		const items = screen.getAllByTestId("weather-penalty-item");
		expect(items[0]).toHaveTextContent("Vi phạm lần 2");
		expect(items[0]).toHaveTextContent("Đang áp dụng");
		expect(within(items[0]).getByRole("button", { name: "Xin miễn phạt" })).toBeVisible();
		expect(items[1]).toHaveTextContent("Đã miễn");
		expect(items[1]).toHaveTextContent("Ghi chú của Admin: Giấy viện hợp lệ");
		expect(within(items[1]).queryByRole("button")).not.toBeInTheDocument();
	});

	it("asks the Host to pay what settlements did not cover within 7 days and flags it once overdue", async () => {
		const api = service({
			listMine: vi.fn().mockResolvedValue(
				mine({
					overdueTotal: "1000000.00",
					hostingBlockedUntil: null,
					items: [
						penalty({
							hostingBlockedUntil: null,
							payment: { ...penalty().payment, overdue: true },
						}),
						penalty({
							id: "p-3",
							tripTitle: "Bidoup",
							outstandingAmount: "0.00",
							payment: {
								...penalty().payment,
								collectedAmount: "1000000.00",
								collectedAt: "2030-01-10T03:00:00.000Z",
								reference: "FT2611230045",
							},
						}),
					],
				})
			),
		});
		renderCard(api);
		expect(await screen.findByTestId("weather-penalty-overdue")).toHaveTextContent(
			/1\.000\.000.*quá hạn nộp/
		);
		const items = screen.getAllByTestId("weather-penalty-item");
		expect(items[0]).toHaveTextContent("Doanh thu Host của chuyến");
		expect(within(items[0]).getByTestId("weather-penalty-payment-due")).toHaveTextContent(
			"Đã quá hạn nộp"
		);
		expect(items[0]).toHaveTextContent('"Phạt thời tiết – Tà Năng – Phan Dũng"');
		expect(within(items[1]).queryByTestId("weather-penalty-payment-due")).not.toBeInTheDocument();
		expect(items[1]).toHaveTextContent("mã giao dịch FT2611230045");
	});

	it("shows where to transfer the penalty, copies the account number, and explains when none is set", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
		const api = service();
		renderCard(api);
		const account = await screen.findByTestId("weather-penalty-payment-account");
		expect(account).toHaveTextContent("Vietcombank");
		expect(account).toHaveTextContent("1028374659");
		expect(account).toHaveTextContent("CONG TY TNHH CTMS VIET NAM");
		expect(screen.getAllByTestId("weather-penalty-payment-due")[0]).toHaveTextContent(
			"vào tài khoản CTMS ở trên"
		);
		fireEvent.click(within(account).getByRole("button", { name: "Sao chép số tài khoản" }));
		await waitFor(() => expect(writeText).toHaveBeenCalledWith("1028374659"));
	});

	it("asks the Host to contact an Admin while no receiving account is set", async () => {
		const api = service({ listMine: vi.fn().mockResolvedValue(mine({ paymentAccount: null })) });
		renderCard(api);
		expect(await screen.findByTestId("weather-penalty-payment-account-missing")).toHaveTextContent(
			"Quản trị viên chưa cập nhật tài khoản nhận tiền phạt"
		);
		expect(screen.queryByTestId("weather-penalty-payment-account")).not.toBeInTheDocument();
	});

	it("hides the waiver button after the deadline or once requested, and shows the suspension", async () => {
		const api = service({
			listMine: vi.fn().mockResolvedValue(
				mine({
					suspended: true,
					items: [
						penalty({ waiverDeadline: "2030-01-11T02:00:00.000Z" }),
						penalty({
							id: "p-2",
							waiver: {
								...penalty().waiver,
								requestedAt: "2030-01-10T05:00:00.000Z",
								reviewDueAt: "2030-01-17T05:00:00.000Z",
							},
						}),
					],
				})
			),
		});
		renderCard(api);
		const items = await screen.findAllByTestId("weather-penalty-item");
		expect(screen.queryByRole("button", { name: "Xin miễn phạt" })).not.toBeInTheDocument();
		expect(items[1]).toHaveTextContent("Chờ duyệt miễn");
		expect(items[1]).toHaveTextContent("Admin xem xét trước 17/01/2030");
		expect(screen.getByTestId("weather-penalty-hosting-block")).toHaveTextContent(
			"đình chỉ tạo Trip"
		);
	});

	it("sends a waiver with a reason and uploaded evidence after confirmation", async () => {
		const api = service();
		renderCard(api);
		fireEvent.click(await screen.findByRole("button", { name: "Xin miễn phạt" }));
		const modal = await screen.findByTestId("weather-penalty-waiver-modal");
		fireEvent.click(within(modal).getByRole("button", { name: "Gửi yêu cầu miễn phạt" }));
		expect(within(modal).getByRole("alert")).toHaveTextContent("Vui lòng nhập lý do");
		fireEvent.change(within(modal).getByLabelText("Lý do (bắt buộc)"), {
			target: { value: "Nhập viện cấp cứu" },
		});
		fireEvent.click(within(modal).getByRole("button", { name: "Gửi yêu cầu miễn phạt" }));
		expect(within(modal).getByRole("alert")).toHaveTextContent("ít nhất 1 file");

		const input = within(modal).getByTestId("weather-penalty-evidence-input");
		fireEvent.change(input, {
			target: { files: [pdf("virus.exe", 10, "application/x-msdownload")] },
		});
		expect(await within(modal).findByRole("alert")).toHaveTextContent("JPG, PNG, WEBP hoặc PDF");
		fireEvent.change(input, { target: { files: [pdf("lon.pdf", 6 * 1024 * 1024)] } });
		expect(await within(modal).findByRole("alert")).toHaveTextContent("tối đa 5MB");
		fireEvent.change(input, { target: { files: [pdf("giay-vien.pdf")] } });
		expect(await within(modal).findByText("giay-vien.pdf")).toBeVisible();
		expect(api.uploadEvidence).toHaveBeenCalledTimes(1);

		fireEvent.click(within(modal).getByRole("button", { name: "Gửi yêu cầu miễn phạt" }));
		const confirm = await screen.findByTestId("confirm-modal");
		fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận" }));
		await waitFor(() =>
			expect(api.requestWaiver).toHaveBeenCalledWith("p-1", {
				reason: "Nhập viện cấp cứu",
				evidenceUrls: ["https://cdn.example/giay-vien.pdf"],
			})
		);
		await waitFor(() =>
			expect(screen.queryByTestId("weather-penalty-waiver-modal")).not.toBeInTheDocument()
		);
	});

	it("explains a closed waiver window in Vietnamese and keeps the form open", async () => {
		const api = service({
			requestWaiver: vi
				.fn()
				.mockRejectedValue(
					new HttpError("Conflict", 409, { message: "The waiver request window has closed" })
				),
		});
		renderCard(api);
		fireEvent.click(await screen.findByRole("button", { name: "Xin miễn phạt" }));
		const modal = await screen.findByTestId("weather-penalty-waiver-modal");
		fireEvent.change(within(modal).getByLabelText("Lý do (bắt buộc)"), {
			target: { value: "Ốm" },
		});
		fireEvent.change(within(modal).getByTestId("weather-penalty-evidence-input"), {
			target: { files: [pdf("a.pdf")] },
		});
		await within(modal).findByText("a.pdf");
		fireEvent.click(within(modal).getByRole("button", { name: "Gửi yêu cầu miễn phạt" }));
		fireEvent.click(
			within(await screen.findByTestId("confirm-modal")).getByRole("button", { name: "Xác nhận" })
		);
		expect(await within(modal).findByRole("alert")).toHaveTextContent("Đã hết hạn gửi yêu cầu");
	});

	it("reloads when the server pushes host.weather_penalty.created", async () => {
		const api = service({
			listMine: vi
				.fn()
				.mockResolvedValue(
					mine({ items: [], outstandingTotal: "0.00", hostingBlockedUntil: null })
				),
		});
		const fake = renderCard(api);
		await waitFor(() => expect(api.listMine).toHaveBeenCalledTimes(1));
		await act(async () => {});
		vi.mocked(api.listMine).mockResolvedValue(mine());
		act(() =>
			fake.latest().serverEmit("host.weather_penalty.created", {
				penaltyId: "p-1",
				tripId: "trip-1",
				tripTitle: "Tà Năng – Phan Dũng",
			})
		);
		expect(await screen.findByTestId("host-weather-penalties-card")).toBeVisible();
		expect(api.listMine).toHaveBeenCalledTimes(2);
	});
});

describe("hostingBlockedMessage", () => {
	it("turns the Trip create / submit 403 of a blocked Host into Vietnamese", () => {
		expect(
			hostingBlockedMessage(
				new HttpError("Forbidden", 403, {
					message: "Host cannot create Trips until the weather penalty block ends",
					blockedUntil: "2030-01-24T01:00:00.000Z",
				})
			)
		).toBe("Bạn đang bị khoá tạo Trip do phạt thời tiết đến 24/01/2030.");
		expect(
			hostingBlockedMessage(
				new HttpError("Forbidden", 403, {
					message: "Host is suspended from hosting because of repeated weather penalties",
					blockedUntil: "2030-03-01T01:00:00.000Z",
				})
			)
		).toContain("đình chỉ tạo Trip");
		expect(
			hostingBlockedMessage(new HttpError("Forbidden", 403, { message: "Not the owner" }))
		).toBeNull();
		expect(
			hostingBlockedMessage(
				new HttpError("Forbidden", 403, {
					code: "WEATHER_PENALTY_OVERDUE",
					message: "Host cannot create Trips until the overdue weather penalty is paid",
					overdueAmount: "71250.00",
				})
			)
		).toMatch(/Bạn chưa nộp 71\.250.*quá hạn 7 ngày/);
		expect(hostingBlockedMessage(new Error("x"))).toBeNull();
	});
});
