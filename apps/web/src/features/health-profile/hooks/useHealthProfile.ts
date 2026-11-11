import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type HealthProfileFormValues, healthProfileSchema } from "../schema/health-profile.schema";
import { healthProfileService } from "../services/health-profile.service";
import type { AllergyItem, HealthProfileData, MedicalConditionItem } from "../types";

export function useHealthProfile() {
	const [profile, setProfile] = useState<HealthProfileData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
	const [apiError, setApiError] = useState<string | null>(null);
	const [conflictError, setConflictError] = useState<boolean>(false);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const form = useForm<HealthProfileFormValues>({
		resolver: zodResolver(healthProfileSchema),
		defaultValues: {
			bloodType: "UNKNOWN",
			physicalFitnessLevel: "BEGINNER",
			dietaryRestrictions: "",
			emergencyNotes: "",
			allergies: [],
			medicalConditions: [],
			isConsentGranted: false,
		},
	});

	const fetchProfile = useCallback(async () => {
		setIsLoading(true);
		setApiError(null);
		setConflictError(false);
		try {
			const data = await healthProfileService.getHealthProfile();
			setProfile(data);

			form.reset({
				bloodType: data.bloodType,
				physicalFitnessLevel: data.physicalFitnessLevel,
				dietaryRestrictions: data.dietaryRestrictions,
				emergencyNotes: data.emergencyNotes,
				allergies: data.allergies,
				medicalConditions: data.medicalConditions,
				isConsentGranted: data.consent.isConsentGranted,
			});
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Không thể tải hồ sơ sức khỏe";
			setApiError(msg);
		} finally {
			setIsLoading(false);
		}
	}, [form]);

	useEffect(() => {
		fetchProfile();
	}, [fetchProfile]);

	const handleAddAllergy = (allergy: AllergyItem) => {
		const current = form.getValues("allergies") || [];
		form.setValue("allergies", [...current, allergy], { shouldDirty: true, shouldValidate: true });
	};

	const handleRemoveAllergy = (id: string) => {
		const current = form.getValues("allergies") || [];
		form.setValue(
			"allergies",
			current.filter((item) => item.id !== id),
			{ shouldDirty: true, shouldValidate: true }
		);
	};

	const handleAddMedicalCondition = (condition: MedicalConditionItem) => {
		const current = form.getValues("medicalConditions") || [];
		form.setValue("medicalConditions", [...current, condition], {
			shouldDirty: true,
			shouldValidate: true,
		});
	};

	const handleRemoveMedicalCondition = (id: string) => {
		const current = form.getValues("medicalConditions") || [];
		form.setValue(
			"medicalConditions",
			current.filter((item) => item.id !== id),
			{ shouldDirty: true, shouldValidate: true }
		);
	};

	const handleRevokeConsent = async () => {
		if (profile?.accountStatus !== "ACTIVE") {
			setApiError(
				"Tài khoản chưa được kích hoạt hoặc đang bị tạm khóa. Không thể thực hiện thao tác này. (BR-202)"
			);
			return;
		}
		setIsSubmitting(true);
		setApiError(null);
		try {
			const updated = await healthProfileService.revokeConsent();
			setProfile(updated);
			form.setValue("isConsentGranted", false, { shouldDirty: false });
			setSuccessMessage("Đã thu hồi quyền chia sẻ thông tin sức khỏe thành công.");
			setTimeout(() => setSuccessMessage(null), 3500);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Thu hồi quyền chia sẻ thất bại";
			setApiError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleGrantConsent = async () => {
		if (profile?.accountStatus !== "ACTIVE") {
			setApiError(
				"Tài khoản chưa được kích hoạt hoặc đang bị tạm khóa. Không thể thực hiện thao tác này. (BR-202)"
			);
			return;
		}
		setIsSubmitting(true);
		setApiError(null);
		try {
			const updated = await healthProfileService.grantConsent();
			setProfile(updated);
			form.setValue("isConsentGranted", true, { shouldDirty: false });
			setSuccessMessage("Đã cấp quyền chia sẻ thông tin sức khỏe cho Host & Porter liên quan.");
			setTimeout(() => setSuccessMessage(null), 3500);
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : "Cấp quyền chia sẻ thất bại";
			setApiError(msg);
		} finally {
			setIsSubmitting(false);
		}
	};

	const onSubmit = async (values: HealthProfileFormValues) => {
		// BR-202 Account Verification Guard
		if (profile?.accountStatus !== "ACTIVE") {
			setApiError(
				"Tài khoản đang bị tạm khóa hoặc chưa xác minh. Không thể cập nhật thông tin. (BR-202)"
			);
			return;
		}

		setIsSubmitting(true);
		setApiError(null);
		setConflictError(false);

		try {
			const updated = await healthProfileService.updateHealthProfile(values, profile.version);
			setProfile(updated);
			form.reset(values);
			setSuccessMessage("Hồ sơ sức khỏe đã được cập nhật thành công.");
			setTimeout(() => setSuccessMessage(null), 3500);
		} catch (err: unknown) {
			const errorObj = err as { statusCode?: number; message?: string };
			if (errorObj?.statusCode === 409 || errorObj?.message === "CONFLICT") {
				// BR-242 Concurrency Conflict Rejection: preserve entered form data, display alert
				setConflictError(true);
				setApiError(
					"Dữ liệu đã bị thay đổi bởi phiên làm việc khác. Dữ liệu bạn vừa nhập đã được giữ lại. Vui lòng tải lại hoặc thử lại."
				);
			} else {
				setApiError(errorObj?.message || "Cập nhật hồ sơ sức khỏe thất bại. Vui lòng thử lại.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleReset = () => {
		if (!profile) return;
		form.reset({
			bloodType: profile.bloodType,
			physicalFitnessLevel: profile.physicalFitnessLevel,
			dietaryRestrictions: profile.dietaryRestrictions,
			emergencyNotes: profile.emergencyNotes,
			allergies: profile.allergies,
			medicalConditions: profile.medicalConditions,
			isConsentGranted: profile.consent.isConsentGranted,
		});
		setConflictError(false);
		setApiError(null);
	};

	return {
		profile,
		isLoading,
		isSubmitting,
		apiError,
		conflictError,
		successMessage,
		form,
		isDirty: form.formState.isDirty,
		fetchProfile,
		handleAddAllergy,
		handleRemoveAllergy,
		handleAddMedicalCondition,
		handleRemoveMedicalCondition,
		handleRevokeConsent,
		handleGrantConsent,
		handleReset,
		handleSubmit: form.handleSubmit(onSubmit),
	};
}
