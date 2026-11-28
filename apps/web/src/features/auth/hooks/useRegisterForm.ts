import { useCallback, useEffect, useState } from "react";
import { toast } from "../../../shared/components/Toast";
import { type TermsVersionDetail, isTermsVersionOutdatedError, termsService } from "../../terms";
import { authService } from "../services/auth.service";
import type {
	AdminRegisterFormData,
	BaseRegisterFormData,
	CamperRegisterFormData,
	HostRegisterFormData,
	PorterRegisterFormData,
	RegisterApiPayload,
	UserRole,
} from "../types";
import {
	type ApiSubmitError,
	isValidEmail,
	isValidPhoneNumber,
	toApiSubmitError,
} from "../utils/auth.utils";
import {
	clearRegisterDraft,
	getRegisterDraft,
	setRegisterDraft,
} from "../utils/registerDraftStore";
import { setVerifyRegistration } from "../utils/verifyRegistrationStorage";

function selectActiveForm(
	role: UserRole,
	camperForm: CamperRegisterFormData,
	hostForm: HostRegisterFormData,
	porterForm: PorterRegisterFormData
): BaseRegisterFormData {
	// Same role -> form mapping (default camper) already used in RegisterPage's renderRoleForm().
	switch (role) {
		case "host":
			return hostForm;
		case "porter":
			return porterForm;
		default:
			return camperForm;
	}
}

function buildRegisterPayload(
	role: UserRole,
	formData: BaseRegisterFormData,
	acceptedTermsVersion: string,
	healthProfileConsent: boolean
): RegisterApiPayload {
	// Email and phone are both mandatory (business flow update) — the form's
	// `required` fields guarantee non-empty values by the time this runs.
	const fullName = formData.fullName.trim();
	const normalizedRole: "camper" | "host" | "porter" =
		role === "host" || role === "porter" ? role : "camper";
	const payload: RegisterApiPayload = {
		email: formData.email,
		phone: formData.phone,
		password: formData.password,
		role: normalizedRole,
		acceptedTermsVersion,
		termsPlatform: "web",
		...(fullName ? { fullName } : {}),
		...(normalizedRole === "camper" && healthProfileConsent ? { healthProfileConsent: true } : {}),
	};
	if (role === "porter") {
		// Seeds the Porter profile so the Admin sees it while reviewing the certificate.
		const porterForm = formData as PorterRegisterFormData;
		const certificationCode = porterForm.certificationCode?.trim();
		payload.experienceYears = porterForm.experienceYears;
		if (certificationCode) payload.certifications = [certificationCode];
	}
	return payload;
}

export function useRegisterForm(onRegisterSuccess: () => void) {
	const initialDraft = getRegisterDraft();
	const prefilledEmail =
		typeof window !== "undefined"
			? (new URLSearchParams(window.location.search).get("email")?.trim() ?? "")
			: "";

	const [currentStep, setCurrentStep] = useState(initialDraft?.currentStep ?? 1);
	const [selectedRole, setSelectedRole] = useState<UserRole>(
		initialDraft?.selectedRole ?? "camper"
	);

	const [camperForm, setCamperForm] = useState<CamperRegisterFormData>(
		initialDraft?.camperForm ?? {
			fullName: "",
			email: prefilledEmail,
			phone: "",
			password: "",
			confirmPassword: "",
			bloodType: "O",
			fitnessLevel: "MEDIUM",
			emergencyContactPhone: "",
		}
	);

	const [hostForm, setHostForm] = useState<HostRegisterFormData>(
		initialDraft?.hostForm ?? {
			fullName: "",
			email: "",
			phone: "",
			password: "",
			confirmPassword: "",
			province: "",
			businessLicense: "",
		}
	);

	const [porterForm, setPorterForm] = useState<PorterRegisterFormData>(
		initialDraft?.porterForm ?? {
			fullName: "",
			email: "",
			phone: "",
			password: "",
			confirmPassword: "",
			experienceYears: 1,
			certificationCode: "",
		}
	);

	const [adminForm, setAdminForm] = useState<AdminRegisterFormData>(
		initialDraft?.adminForm ?? {
			fullName: "",
			email: "",
			phone: "",
			password: "",
			confirmPassword: "",
			adminSecretKey: "",
		}
	);

	// Always unchecked by default unless restored from an active draft during the same session.
	const [acceptedTerms, setAcceptedTerms] = useState<boolean>(initialDraft?.acceptedTerms ?? false);
	const [healthProfileConsent, setHealthProfileConsent] = useState<boolean>(
		initialDraft?.healthProfileConsent ?? false
	);

	const [currentTerms, setCurrentTerms] = useState<TermsVersionDetail | null>(null);
	const [isLoadingTerms, setIsLoadingTerms] = useState<boolean>(true);
	const [termsLoadError, setTermsLoadError] = useState<string | null>(null);

	const loadCurrentTerms = useCallback(async () => {
		setIsLoadingTerms(true);
		setTermsLoadError(null);
		try {
			const terms = await termsService.getCurrent();
			setCurrentTerms(terms);
		} catch {
			setTermsLoadError("Không thể tải phiên bản điều khoản hiện hành. Vui lòng thử lại.");
		} finally {
			setIsLoadingTerms(false);
		}
	}, []);

	useEffect(() => {
		void loadCurrentTerms();
	}, [loadCurrentTerms]);

	const saveDraftForTermsNavigation = useCallback(() => {
		setRegisterDraft({
			currentStep,
			selectedRole,
			camperForm,
			hostForm,
			porterForm,
			adminForm,
			acceptedTerms,
			healthProfileConsent,
		});
	}, [
		currentStep,
		selectedRole,
		camperForm,
		hostForm,
		porterForm,
		adminForm,
		acceptedTerms,
		healthProfileConsent,
	]);

	const updateCamperForm = (field: keyof CamperRegisterFormData, value: unknown) => {
		setCamperForm((prev) => ({ ...prev, [field]: value }));
	};

	const updateHostForm = (field: keyof HostRegisterFormData, value: unknown) => {
		setHostForm((prev) => ({ ...prev, [field]: value }));
	};

	const updatePorterForm = (field: keyof PorterRegisterFormData, value: unknown) => {
		setPorterForm((prev) => ({ ...prev, [field]: value }));
	};

	const updateAdminForm = (field: keyof AdminRegisterFormData, value: unknown) => {
		setAdminForm((prev) => ({ ...prev, [field]: value }));
	};

	const handleNextStep = () => {
		if (currentStep < 2) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handlePrevStep = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<ApiSubmitError | null>(null);

	const handleRegisterSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// BR-241: ignore additional submits while a request is already in flight.
		if (isSubmitting) {
			return;
		}

		setSubmitError(null);

		if (!currentTerms) {
			setSubmitError({
				message: "Chưa tải được phiên bản Điều khoản sử dụng hiện hành. Vui lòng thử tải lại.",
			});
			return;
		}

		if (!acceptedTerms) {
			setSubmitError({
				message:
					"Vui lòng đọc và đồng ý với Điều khoản và Điều kiện sử dụng DiTrek trước khi đăng ký.",
			});
			return;
		}

		setIsSubmitting(true);

		try {
			const activeForm = selectActiveForm(selectedRole, camperForm, hostForm, porterForm);
			const payload = buildRegisterPayload(
				selectedRole,
				activeForm,
				currentTerms.version,
				healthProfileConsent
			);

			if (payload.email && !isValidEmail(payload.email)) {
				setSubmitError({ message: "Email không đúng định dạng" });
				return;
			}
			if (payload.phone && !isValidPhoneNumber(payload.phone)) {
				setSubmitError({ message: "Số điện thoại không đúng định dạng" });
				return;
			}

			const result = await authService.register(payload);
			clearRegisterDraft();

			setVerifyRegistration({
				userId: result.id,
				email: result.email ?? "",
				phone: result.phone ?? "",
			});
			onRegisterSuccess();
		} catch (error) {
			if (isTermsVersionOutdatedError(error)) {
				setAcceptedTerms(false);
				void loadCurrentTerms();
				const msg =
					"Điều khoản sử dụng vừa được cập nhật phiên bản mới. Vui lòng xem lại và đồng ý trước khi hoàn tất đăng ký.";
				setSubmitError({ message: msg });
				toast.warning(msg);
				return;
			}
			// BR-242: entered data is left untouched (no reset), only the error is captured.
			setSubmitError(toApiSubmitError(error, "Đăng ký thất bại. Vui lòng thử lại."));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		currentStep,
		selectedRole,
		setSelectedRole,
		camperForm,
		updateCamperForm,
		hostForm,
		updateHostForm,
		porterForm,
		updatePorterForm,
		adminForm,
		updateAdminForm,
		acceptedTerms,
		setAcceptedTerms,
		healthProfileConsent,
		setHealthProfileConsent,
		currentTerms,
		isLoadingTerms,
		termsLoadError,
		reloadTerms: loadCurrentTerms,
		saveDraftForTermsNavigation,
		handleNextStep,
		handlePrevStep,
		handleRegisterSubmit,
		isSubmitting,
		submitError,
	};
}
