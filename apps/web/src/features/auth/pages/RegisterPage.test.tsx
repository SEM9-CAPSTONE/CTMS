import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { TERMS_OUTDATED_CODE, termsService } from "../../terms";
import { authService } from "../services/auth.service";
import { clearRegisterDraft } from "../utils/registerDraftStore";
import { RegisterPage } from "./RegisterPage";

vi.mock("../services/auth.service", () => ({
	authService: {
		register: vi.fn(),
	},
}));

vi.mock("../../terms", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../terms")>();
	return {
		...actual,
		termsService: {
			...actual.termsService,
			getCurrent: vi.fn(),
		},
	};
});

const registerMock = vi.mocked(authService.register);
const getCurrentTermsMock = vi.mocked(termsService.getCurrent);

const ACTIVE_TERMS = {
	id: "terms-v1-id",
	version: "1.0",
	title: "Điều khoản và Điều kiện sử dụng CTMS",
	summary: "Phiên bản khởi tạo 12 mục.",
	effectiveDate: "2026-11-27",
	isActive: true,
	requiresReconsent: true,
	publishedAt: "2026-11-27T00:00:00.000Z",
	sections: [],
};

const SUCCESS_RESPONSE = {
	id: "11111111-1111-1111-1111-111111111111",
	email: "camper@example.com",
	phone: "+84912345678",
	role: "camper" as const,
	roles: ["camper" as const],
	status: "pending_verification" as const,
	createdAt: new Date().toISOString(),
};

async function renderAndGoToStep2(
	user: ReturnType<typeof userEvent.setup>,
	onNavigateToVerifyOtp: () => void = vi.fn(),
	onNavigateToTerms: () => void = vi.fn()
) {
	render(
		<RegisterPage
			onBackToHome={vi.fn()}
			onNavigateToLogin={vi.fn()}
			onNavigateToVerifyOtp={onNavigateToVerifyOtp}
			onNavigateToTerms={onNavigateToTerms}
		/>
	);
	await user.click(screen.getByRole("button", { name: /tiếp tục nhập thông tin/i }));
	await screen.findByText(/v1\.0/);
}

async function fillRequiredCommonFields(user: ReturnType<typeof userEvent.setup>) {
	await user.type(screen.getByPlaceholderText("Nguyễn Văn A"), "Nguyen Van A");
	const passwordInputs = screen.getAllByPlaceholderText("••••••••");
	await user.type(passwordInputs[0], "s3cretPass");
	await user.type(passwordInputs[1], "s3cretPass");
}

async function checkTermsConsent(user: ReturnType<typeof userEvent.setup>) {
	const checkbox = screen.getByRole("checkbox", {
		name: /tôi đã đọc và đồng ý với điều khoản/i,
	});
	await user.click(checkbox);
}

function submitButton() {
	return screen.getByRole("button", { name: /đăng ký ngay/i });
}

describe("RegisterPage", () => {
	beforeEach(() => {
		registerMock.mockReset();
		getCurrentTermsMock.mockReset();
		getCurrentTermsMock.mockResolvedValue(ACTIVE_TERMS);
		clearRegisterDraft();
		sessionStorage.clear();
	});

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

	it("renders email, phone, and unchecked terms checkbox on step 2 without health consent checkbox", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);

		expect(screen.getByPlaceholderText("camper@example.com")).toBeInTheDocument();
		expect(screen.getByPlaceholderText("0912345678")).toBeInTheDocument();
		const termsCheckbox = screen.getByRole("checkbox", {
			name: /tôi đã đọc và đồng ý với điều khoản/i,
		});
		expect(termsCheckbox).not.toBeChecked();
		expect(screen.queryByRole("checkbox", { name: /hồ sơ sức khỏe/i })).not.toBeInTheDocument();
	});

	it("blocks registration when Terms checkbox is left unchecked", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.click(submitButton());

		expect(await screen.findByText(/vui lòng đọc và đồng ý với điều khoản/i)).toBeInTheDocument();
		expect(registerMock).not.toHaveBeenCalled();
	});

	it("preserves entered form data when opening Terms and returning to RegisterPage", async () => {
		const user = userEvent.setup();
		const onNavigateToTerms = vi.fn();

		const { unmount } = render(
			<RegisterPage
				onBackToHome={vi.fn()}
				onNavigateToLogin={vi.fn()}
				onNavigateToVerifyOtp={vi.fn()}
				onNavigateToTerms={onNavigateToTerms}
			/>
		);
		await user.click(screen.getByRole("button", { name: /tiếp tục nhập thông tin/i }));
		await screen.findByText(/v1\.0/);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "keepme@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");

		await user.click(screen.getByRole("button", { name: /điều khoản và chính sách sử dụng/i }));
		expect(onNavigateToTerms).toHaveBeenCalledTimes(1);

		// Simulate unmounting to visit /terms, then returning to /register
		unmount();
		render(
			<RegisterPage
				onBackToHome={vi.fn()}
				onNavigateToLogin={vi.fn()}
				onNavigateToVerifyOtp={vi.fn()}
				onNavigateToTerms={onNavigateToTerms}
			/>
		);

		expect(screen.getByPlaceholderText("Nguyễn Văn A")).toHaveValue("Nguyen Van A");
		expect(screen.getByPlaceholderText("camper@example.com")).toHaveValue("keepme@example.com");
		expect(screen.getByPlaceholderText("0912345678")).toHaveValue("0912345678");
	});

	it("registers with email, phone, and acceptedTermsVersion without requiring optional health consent", async () => {
		const user = userEvent.setup();
		registerMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await checkTermsConsent(user);
		await user.click(submitButton());

		await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
		expect(registerMock).toHaveBeenCalledWith({
			email: "camper@example.com",
			phone: "0912345678",
			password: "s3cretPass",
			role: "camper",
			fullName: "Nguyen Van A",
			acceptedTermsVersion: "1.0",
			termsPlatform: "web",
		});
	});

	it("sends the Porter's name, experience, certificate code, and acceptedTermsVersion", async () => {
		const user = userEvent.setup();
		registerMock.mockResolvedValueOnce({ ...SUCCESS_RESPONSE, role: "porter" });
		render(
			<RegisterPage
				onBackToHome={vi.fn()}
				onNavigateToLogin={vi.fn()}
				onNavigateToVerifyOtp={vi.fn()}
			/>
		);
		await user.click(screen.getByText(/Porter/, { selector: "h3, p, span, div" }));
		expect(screen.getByText("Chứng chỉ")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /tiếp tục nhập thông tin/i }));
		await screen.findByText(/v1\.0/);

		expect(screen.queryByPlaceholderText(/Tà Xùa/)).not.toBeInTheDocument();
		await user.type(screen.getByPlaceholderText("Lý A Porter"), " Ly A Porter ");
		await user.type(screen.getByPlaceholderText("porter@example.com"), "porter@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await user.clear(screen.getByPlaceholderText("3"));
		await user.type(screen.getByPlaceholderText("3"), "5");
		await user.type(screen.getByPlaceholderText("PTR-8821"), " PTR-1234 ");
		const passwordInputs = screen.getAllByPlaceholderText("••••••••");
		await user.type(passwordInputs[0], "s3cretPass");
		await user.type(passwordInputs[1], "s3cretPass");
		await checkTermsConsent(user);
		await user.click(submitButton());

		await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
		expect(registerMock).toHaveBeenCalledWith({
			email: "porter@example.com",
			phone: "0912345678",
			password: "s3cretPass",
			role: "porter",
			fullName: "Ly A Porter",
			experienceYears: 5,
			certifications: ["PTR-1234"],
			acceptedTermsVersion: "1.0",
			termsPlatform: "web",
		});
	});

	it("shows a field-level error for an invalid email and does not call the API", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "not-an-email");
		await checkTermsConsent(user);
		await user.click(submitButton());

		expect(await screen.findByText("Email không đúng định dạng")).toBeInTheDocument();
		expect(registerMock).not.toHaveBeenCalled();
	});

	it("shows a field-level error for an invalid phone and does not call the API", async () => {
		const user = userEvent.setup();
		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("0912345678"), "0123456789");
		await checkTermsConsent(user);
		await user.click(submitButton());

		expect(
			await screen.findByText("Số điện thoại không đúng định dạng (VD: 0912345678)")
		).toBeInTheDocument();
		expect(registerMock).not.toHaveBeenCalled();
	});

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
		await checkTermsConsent(user);

		const button = submitButton();
		await user.click(button);
		await user.click(button);
		await user.click(button);

		expect(registerMock).toHaveBeenCalledTimes(1);

		resolveRegister(SUCCESS_RESPONSE);
	});

	it("disables the submit button and shows the loading label while the request is pending", async () => {
		const user = userEvent.setup();
		registerMock.mockImplementationOnce(() => new Promise(() => {}));

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await checkTermsConsent(user);
		await user.click(submitButton());

		const loadingButton = await screen.findByRole("button", { name: /đang xử lý/i });
		expect(loadingButton).toBeDisabled();
	});

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
		await checkTermsConsent(user);
		await user.click(submitButton());

		expect(await screen.findByText("Email or phone already registered")).toBeInTheDocument();
		expect(emailInput).toHaveValue("camper@example.com");
	});

	it("resets terms checkbox and reloads terms when backend returns 409 TERMS_VERSION_OUTDATED", async () => {
		const user = userEvent.setup();
		getCurrentTermsMock
			.mockResolvedValueOnce(ACTIVE_TERMS)
			.mockResolvedValueOnce({ ...ACTIVE_TERMS, version: "1.1", effectiveDate: "2026-12-01" });
		registerMock.mockRejectedValueOnce(
			new HttpError("Conflict", 409, {
				statusCode: 409,
				code: TERMS_OUTDATED_CODE,
				currentVersion: "1.1",
			})
		);

		await renderAndGoToStep2(user);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await checkTermsConsent(user);
		await user.click(submitButton());

		expect(
			await screen.findByText(/điều khoản sử dụng vừa được cập nhật phiên bản mới/i)
		).toBeInTheDocument();
		expect(
			screen.getByRole("checkbox", { name: /tôi đã đọc và đồng ý với điều khoản/i })
		).not.toBeChecked();
		expect(await screen.findByText(/v1\.1/)).toBeInTheDocument();
	});

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
		await checkTermsConsent(user);
		await user.click(submitButton());

		expect(
			await screen.findByText("phone must be a valid Vietnamese mobile number")
		).toBeInTheDocument();
	});

	it("stores the registration context in sessionStorage and navigates to Verify OTP after 201", async () => {
		const user = userEvent.setup();
		const onNavigateToVerifyOtp = vi.fn();
		registerMock.mockResolvedValueOnce(SUCCESS_RESPONSE);

		await renderAndGoToStep2(user, onNavigateToVerifyOtp);
		await fillRequiredCommonFields(user);
		await user.type(screen.getByPlaceholderText("camper@example.com"), "camper@example.com");
		await user.type(screen.getByPlaceholderText("0912345678"), "0912345678");
		await checkTermsConsent(user);
		await user.click(submitButton());

		await waitFor(() => expect(onNavigateToVerifyOtp).toHaveBeenCalledTimes(1));

		const stored = JSON.parse(sessionStorage.getItem("verify-registration") ?? "null");
		expect(stored).toEqual({
			userId: SUCCESS_RESPONSE.id,
			email: SUCCESS_RESPONSE.email,
			phone: SUCCESS_RESPONSE.phone,
		});
	});
});
