import { useState } from "react";
import { authService } from "../services/auth.service";
import type { LoginFormData } from "../types";

export function useLoginForm() {
	const [showPassword, setShowPassword] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formData, setFormData] = useState<LoginFormData>({
		email: "",
		password: "",
		rememberMe: false,
	});

	const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

	const updateField = (field: keyof LoginFormData, value: string | boolean) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
	};

	const handleLoginSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			const res = await authService.login(formData);
			if (res.success) {
				alert(`Đăng nhập thành công! Chào mừng ${res.user.name}`);
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		formData,
		showPassword,
		isSubmitting,
		togglePasswordVisibility,
		updateField,
		handleLoginSubmit,
	};
}
