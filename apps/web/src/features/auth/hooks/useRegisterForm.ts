import { useState } from "react";
import type {
	AdminRegisterFormData,
	CamperRegisterFormData,
	HostRegisterFormData,
	PorterRegisterFormData,
	UserRole,
} from "../types";

export function useRegisterForm() {
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
		if (currentStep < 3) {
			setCurrentStep((prev) => prev + 1);
		}
	};

	const handlePrevStep = () => {
		if (currentStep > 1) {
			setCurrentStep((prev) => prev - 1);
		}
	};

	const handleRegisterSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleNextStep();
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
	};
}
