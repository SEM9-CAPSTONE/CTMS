import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestingLibrary = typeof import("@testing-library/react");
type UserEvent = typeof import("@testing-library/user-event").default;
type RouteRegistrationBlockPanelComponent = typeof import(
	"./RouteRegistrationBlockPanel"
).RouteRegistrationBlockPanel;

let testingLibrary: TestingLibrary;
let userEvent: UserEvent;
let RouteRegistrationBlockPanel: RouteRegistrationBlockPanelComponent;
let checkRegistrationEligibilityMock: ReturnType<typeof vi.fn>;

describe("RouteRegistrationBlockPanel", () => {
	beforeEach(async () => {
		vi.resetModules();
		vi.doUnmock("../../../core/api");
		checkRegistrationEligibilityMock = vi.fn().mockResolvedValue({
			allowed: true,
			routeId: "route-1",
			riskLevel: "green",
			assessmentTime: "2026-09-03T10:00:00.000Z",
			compositeScore: 0.2,
			reasons: [],
		});

		vi.doMock("../services/trekking-routes.service", () => ({
			trekkingRoutesService: {
				checkRegistrationEligibility: checkRegistrationEligibilityMock,
			},
		}));

		[testingLibrary, { default: userEvent }, { RouteRegistrationBlockPanel }] = await Promise.all([
			import("@testing-library/react"),
			import("@testing-library/user-event"),
			import("./RouteRegistrationBlockPanel"),
		]);
	});

	afterEach(() => {
		testingLibrary.cleanup();
		vi.doUnmock("../services/trekking-routes.service");
		vi.resetModules();
	});

	it("renders loading state initially", () => {
		testingLibrary.render(
			<RouteRegistrationBlockPanel routeId="route-1" routeName="Trekking Route Test" />
		);

		expect(
			testingLibrary.screen.getByTestId("registration-eligibility-loading")
		).toBeInTheDocument();
		expect(
			testingLibrary.screen.getByText(/Đang kiểm tra điều kiện an toàn thời tiết/i)
		).toBeInTheDocument();
	});

	it("renders allowed state (GREEN / YELLOW) with active action button", async () => {
		const onProceed = vi.fn();
		testingLibrary.render(
			<RouteRegistrationBlockPanel
				routeId="route-1"
				routeName="Trekking Route Test"
				onProceedBooking={onProceed}
			/>
		);

		expect(
			await testingLibrary.screen.findByTestId("registration-allowed-badge")
		).toBeInTheDocument();
		expect(
			testingLibrary.screen.getByText(/Tuyến đường đủ điều kiện an toàn để nhận đăng ký/i)
		).toBeInTheDocument();

		const submitBtn = testingLibrary.screen.getByTestId("btn-submit-booking");
		expect(submitBtn).not.toBeDisabled();

		await userEvent.click(submitBtn);
		expect(onProceed).toHaveBeenCalledTimes(1);
	});

	it("renders BLOCKED state (RED risk) with warning banner, assessment time, failing criteria reasons, and disabled action button (BR-071, BR-072, BR-073)", async () => {
		const { HttpError } = await import("../../../core/api");
		const blockedErr = new HttpError("Conflict", 409, {
			statusCode: 409,
			message: "New registrations are blocked because route weather risk is RED",
			allowed: false,
			routeId: "route-1",
			riskLevel: "red",
			assessmentTime: "2026-09-03T12:00:00.000Z",
			compositeScore: 1.5,
			reasons: [
				{
					criterion: "rainfall",
					level: "red",
					value: 80,
					message: "Rainfall (80mm) exceeds Red threshold",
				},
				{
					criterion: "wind",
					level: "red",
					value: 85,
					message: "Wind speed (85km/h) exceeds Red threshold",
				},
			],
		});

		checkRegistrationEligibilityMock.mockRejectedValue(blockedErr);

		const onProceed = vi.fn();
		testingLibrary.render(
			<RouteRegistrationBlockPanel
				routeId="route-1"
				routeName="Trekking Route Test"
				onProceedBooking={onProceed}
			/>
		);

		// Warning banner rendered
		expect(
			await testingLibrary.screen.findByTestId("registration-blocked-banner")
		).toBeInTheDocument();
		expect(
			testingLibrary.screen.getByText(
				/Tạm dừng nhận đăng ký chuyến đi mới \(Rủi ro thời tiết MỨC ĐỎ\)/i
			)
		).toBeInTheDocument();

		// Assessment time & composite score rendered
		expect(testingLibrary.screen.getByTestId("assessment-time")).toBeInTheDocument();
		expect(testingLibrary.screen.getByTestId("composite-score")).toHaveTextContent("1.50");

		// Reasons breakdown rendered
		expect(testingLibrary.screen.getByTestId("blocked-reasons-list")).toBeInTheDocument();
		expect(testingLibrary.screen.getByTestId("reason-item-rainfall")).toHaveTextContent(
			"Rainfall (80mm) exceeds Red threshold"
		);
		expect(testingLibrary.screen.getByTestId("reason-item-wind")).toHaveTextContent(
			"Wind speed (85km/h) exceeds Red threshold"
		);

		// Submit button disabled
		const submitBtn = testingLibrary.screen.getByTestId("btn-submit-booking");
		expect(submitBtn).toBeDisabled();
		expect(submitBtn).toHaveTextContent(/Tạm dừng đăng ký \(Rủi ro Mức Đỏ\)/i);

		await userEvent.click(submitBtn);
		expect(onProceed).not.toHaveBeenCalled();
	});

	it("triggers reload when reload button is clicked", async () => {
		testingLibrary.render(<RouteRegistrationBlockPanel routeId="route-1" />);

		await testingLibrary.screen.findByTestId("registration-allowed-badge");

		await userEvent.click(testingLibrary.screen.getByTestId("btn-reload-eligibility"));
		expect(checkRegistrationEligibilityMock).toHaveBeenCalledTimes(2);
	});
});
