import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { authService } from "../services/auth.service";
import { RegisterPage } from "./RegisterPage";

// Mock at the service boundary (not httpClient/fetch) — this is a Component
// Test: RegisterPage's visible behavior in response to what its service
// dependency returns, not a real network call (that's covered by the
// separate Integration Test suite already built for CTMS-01-T01 backend).
vi.mock("../services/auth.service", () => ({
	authService: {
		register: vi.fn(),
	},
}));

const registerMock = vi.mocked(authService.register);

// Email and phone are both mandatory (business flow update) — the backend
// response always includes both, never null.
const SUCCESS_RESPONSE = {
	id: "11111111-1111-1111-1111-111111111111",
	email: "camper@example.com",
	phone: "+84912345678",
	role: "camper" as const,
	status: "pending_verification" as const,
	createdAt: new Date().toISOString(),
};

async function renderAndGoToStep2(
	user: ReturnType<typeof userEvent.setup>,
	onNavigateToVerifyOtp: () => void = vi.fn()
) {
	render(
		<RegisterPage
			onBackToHome={vi.fn()}
			onNavigateToLogin={vi.fn()}
			onNavigateToVerifyOtp={onNavigateToVerifyOtp}
		/>
	);
	await user.click(screen.getByRole("button", { name: /tiếp tục nhập thông tin/i }));
}

/** Fills fullName/password/confirmPassword. Email and phone are both required
 * (business flow update) — each test fills them explicitly since their exact
 * values (or intentional invalidity) are what each test is verifying. */
async function fillRequiredCommonFields(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByPlaceholderText("Nguyễn Văn A"), "Nguyen Van A");
	const passwordInputs = screen.getAllByPlaceholderText("••••••••");
	await user.type(passwordInputs[0], "s3cretPass");
	await user.type(passwordInputs[1], "s3cretPass");
}

function submitButton() {
	return screen.getByRole("button", { name: /đăng ký ngay/i });
}

describe("RegisterPage", () => {
	beforeEach(() => {
		registerMock.mockReset();
		sessionStorage.clear();
	});

	// TC1 — Render email/phone registration modes correctly (step 1 default)
	it("renders the role selection step by default", () => {
		render(
			<RegisterPage
				onBackToHome={vi.fn()}
				onNavigateToLogin={vi.fn()}
				onNavigateToVerifyOtp={vi.fn()}
			/>
		);
		expect(
			screen.getByText("Chào bạn, bạn muốn tham gia CTMS với vai trò nào?")
		).toBeInTheDocument();
	});

	// TC2 — Render email/phone registration modes correctly (step 2 fields)
	it("renders email and phone fields on the role-specific form step", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);

		expect(screen.getByPlaceholderText("camper@example.com")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("0912345678")).toBeInTheDocument();
	});

	// TC3 — Registration with email AND phone (both mandatory) + correct authService.register payload
	it("registers with email and phone and calls authService.register with the correct payload", async () => {
		const user = userEvent.setup();
		registerMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
		// Frontend sends the raw phone value as typed; normalizing to E.164 is
		// the backend's responsibility (RegisterDto's @Transform, CTMS-14) —
		// not something buildRegisterPayload() does.
		expect(registerMock).toHaveBeenCalledWith({
			email: "camper@example.com",
			phone: "0912345678",
			password: "s3cretPass",
			role: "camper",
		});
	});

	// TC5 — Client-side validation: invalid email blocks submit
	it("shows a field-level error for an invalid email and does not call the API", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "not-an-email");
		await user.click(submitButton());

		expect(await screen.findByText("Email không đúng định dạng")).toBeInTheDocument();
		expect(registerMock).not.toHaveBeenCalled();
	});

	// TC6 — Client-side validation: invalid phone blocks submit
	it("shows a field-level error for an invalid phone and does not call the API", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("0912345678"), "0123456789");
		await user.click(submitButton());

		expect(
			await screen.findByText("Số điện thoại không đúng định dạng (VD: 0912345678)")
		).toBeInTheDocument();
		expect(registerMock).not.toHaveBeenCalled();
	});

	// TC7 — Prevent repeated submissions (BR-241)
	it("prevents a second submit while a request is already in flight", async () => {
		const user = userEvent.setup();
		let resolveRegister: (value: typeof SUCCESS_RESPONSE) => void = () => {};
		registerMock.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveRegister = resolve;
				})
		);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");

		const button = submitButton();
		await user.click(button);
		await user.click(button);
		await user.click(button);

		expect(registerMock).toHaveBeenCalledTimes(1);

		resolveRegister(SUCCESS_RESPONSE);
	});

	// TC8 — Loading state (BR-241)
	it("disables the submit button and shows the loading label while the request is pending", async () => {
		const user = userEvent.setup();
		registerMock.mockImplementationOnce(() => new Promise(() => {}));

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		const loadingButton = await screen.findByRole("button", { name: /đang xử lý/i });
		expect(loadingButton).toBeDisabled();
	});

	// TC9 — Duplicate-account error (409) + entered data preserved (BR-242)
	it("shows the duplicate-account error on 409 and keeps the entered data", async () => {
		const user = userEvent.setup();
		registerMock.mockRejectedValueOnce(
			new HttpError("Email or phone already registered", 409, {
				statusCode: 409,
				message: "Email or phone already registered",
				error: "Conflict",
			})
		);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		const emailInput = screen.getByPlaceholderText("camper@example.com");
		await user.type(emailInput, "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		expect(await screen.findByText("Email or phone already registered")).toBeInTheDocument();
		expect(emailInput).toHaveValue("camper@example.com");
	});

	// TC10 — 422 validation error: field-level messages returned by the
	// backend are rendered as-is. Both email and phone are now client-required
	// (native HTML5 constraint blocks submit when either is empty), so the
	// old "leave both empty" cross-field scenario is no longer reachable
	// through the UI — this instead simulates a 422 the client-side format
	// checks don't already catch (backend is authoritative per BR-206), using
	// the actual message emitted by RegisterDto's phone validator.
	it("shows all field-level messages returned by a 422 validation error", async () => {
		const user = userEvent.setup();
		registerMock.mockRejectedValueOnce(
			new HttpError("Unprocessable Entity", 422, {
				statusCode: 422,
				error: "Unprocessable Entity",
				message: [{ field: "phone", errors: ["phone must be a valid Vietnamese mobile number"] }],
			})
		);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		expect(
			await screen.findByText("phone must be a valid Vietnamese mobile number")
		).toBeInTheDocument();
	});

	// TC11 — Success: navigates to Verify OTP and stores the registration
	// context in sessionStorage (Phase 2 Decision Gate), instead of showing a
	// static success screen.
	it("stores the registration context in sessionStorage and navigates to Verify OTP after the backend confirms with 201", async () => {
		const user = userEvent.setup();
		const onNavigateToVerifyOtp = vi.fn();
		registerMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		await renderAndGoToStep2(user, onNavigateToVerifyOtp);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		await waitFor(() => expect(onNavigateToVerifyOtp).toHaveBeenCalledTimes(1));

		// userId must be carried via sessionStorage, never a URL query param.
		const stored = JSON.parse(sessionStorage.getItem("verify-registration") ?? "null");
		expect(stored).toEqual({
			userId: SUCCESS_RESPONSE.id,
			email: SUCCESS_RESPONSE.email,
			phone: SUCCESS_RESPONSE.phone,
		});
	});
});
