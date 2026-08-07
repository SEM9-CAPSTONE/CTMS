import { useState } from "react";
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

function buildRegisterPayload(role: UserRole, formData: BaseRegisterFormData): RegisterApiPayload {
	// Email and phone are both mandatory (business flow update) — the form's
	// `required` fields guarantee non-empty values by the time this runs.
	return {
		email: formData.email,
		phone: formData.phone,
		password: formData.password,
		role: role === "host" || role === "porter" ? role : "camper",
	};
}

export function useRegisterForm(onRegisterSuccess: () => void) {
	const [currentStep, setCurrentStep] = useState(1);
	const [selectedRole, setSelectedRole] = useState<UserRole>("camper");

	const [camperForm, setCamperForm] = useState<CamperRegisterFormData>({
		fullName: "",
		email: "",
		phone: "",
		password: "",
		confirmPassword: "",
		bloodType: "O",
		fitnessLevel: "MEDIUM",
		emergencyContactPhone: "",
	});

	const [hostForm, setHostForm] = useState<HostRegisterFormData>({
		fullName: "",
		email: "",
		phone: "",
		password: "",
		confirmPassword: "",
		campsiteName: "",
		province: "",
		businessLicense: "",
	});

	const [porterForm, setPorterForm] = useState<PorterRegisterFormData>({
		fullName: "",
		email: "",
		phone: "",
		password: "",
		confirmPassword: "",
		experienceYears: 1,
		operatingAreas: "",
		certificationCode: "",
	});

	const [adminForm, setAdminForm] = useState<AdminRegisterFormData>({
		fullName: "",
		email: "",
		phone: "",
		password: "",
		confirmPassword: "",
		adminSecretKey: "",
	});

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
		// Only role-selection (1) -> form (2) now; Step 3 was the static
		// success screen, replaced by navigating to VerifyOtpPage on success.
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
		setIsSubmitting(true);

		try {
			const activeForm = selectActiveForm(selectedRole, camperForm, hostForm, porterForm);
			const payload = buildRegisterPayload(selectedRole, activeForm);

			// Block only on wrong format for a filled field. Both email and phone
			// empty is intentionally left to the backend, which returns 422 per
			// the existing API contract (no cross-field validation added here).
			if (payload.email && !isValidEmail(payload.email)) {
				setSubmitError({ message: "Email không đúng định dạng" });
				return;
			}
			if (payload.phone && !isValidPhoneNumber(payload.phone)) {
				setSubmitError({ message: "Số điện thoại không đúng định dạng" });
				return;
			}

			const result = await authService.register(payload);

			// Phase 2 Decision Gate: userId/email/phone are handed to
			// VerifyOtpPage via sessionStorage, never a URL query param.
			setVerifyRegistration({
				userId: result.id,
				email: result.email ?? "",
				phone: result.phone ?? "",
			});
			onRegisterSuccess();
		} catch (error) {
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
		handleNextStep,
		handlePrevStep,
		handleRegisterSubmit,
		isSubmitting,
		submitError,
	};
}
