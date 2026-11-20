import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { HttpError, queryKeys } from "../../../core/api";
import { toast } from "../../../shared/components/Toast";
import { getStoredAuthUser } from "../../auth/utils/tokenStorage";
import { type HealthProfileFormValues, healthProfileSchema } from "../schema/health-profile.schema";
import { healthProfileService } from "../services/health-profile.service";
import type { AllergyItem, HealthProfileData, MedicalConditionItem } from "../types";

function formValues(profile: HealthProfileData): HealthProfileFormValues {
	return {
		activityProfile: {
			comfortableDistanceKm: profile.activityProfile?.comfortableDistanceKm ?? null,
			comfortableWalkingMinutes: profile.activityProfile?.comfortableWalkingMinutes ?? null,
			activityNotes: profile.activityProfile?.activityNotes ?? "",
		},
		bloodType: profile.bloodType,
		physicalFitnessLevel: profile.physicalFitnessLevel,
		dietaryRestrictions: profile.dietaryRestrictions,
		emergencyNotes: profile.emergencyNotes,
		allergies: profile.allergies,
		medicalConditions: profile.medicalConditions,
		isConsentGranted: profile.consent.isConsentGranted,
	};
}

function errorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 409)
			return "Hồ sơ đã thay đổi ở phiên khác. Thông tin bạn đang nhập được giữ lại; hãy tải dữ liệu mới trước khi lưu.";
		if (error.status === 422)
			return "Thông tin sức khỏe chưa hợp lệ. Vui lòng kiểm tra lại các trường đã nhập.";
		if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
		if (error.status === 403)
			return "Bạn chưa được phép thay đổi hồ sơ sức khỏe. Vui lòng kiểm tra trạng thái tài khoản.";
	}
	return "Không thể tải hoặc lưu hồ sơ sức khỏe. Vui lòng thử lại.";
}

export function useHealthProfile() {
	const client = useQueryClient();
	const userId = getStoredAuthUser()?.id ?? "";
	const profileKey = queryKeys.healthProfile.me(userId);
	const query = useQuery({
		queryKey: profileKey,
		queryFn: healthProfileService.getHealthProfile,
		enabled: Boolean(userId),
		retry: false,
		refetchOnMount: "always",
	});
	const profile = query.data ?? null;
	const form = useForm<HealthProfileFormValues>({ resolver: zodResolver(healthProfileSchema) });
	const formOwner = useRef(userId);
	useEffect(() => {
		if (profile && (formOwner.current !== userId || !form.formState.isDirty)) {
			form.reset(formValues(profile));
			formOwner.current = userId;
		}
	}, [profile, form, userId]);

	const updateCache = (saved: HealthProfileData) => {
		if (getStoredAuthUser()?.id !== userId) return false;
		client.setQueryData(profileKey, saved);
		client.removeQueries({ queryKey: queryKeys.tripRecommendations.explanations(userId) });
		if (!saved.consent.isConsentGranted) {
			client.setQueryData(queryKeys.tripRecommendations.list(userId), {
				status: "needs_health_consent",
				items: [],
				mode: null,
				generatedAt: new Date().toISOString(),
			});
		}
		void client.invalidateQueries({ queryKey: queryKeys.tripRecommendations.list(userId) });
		return true;
	};
	const save = useMutation({
		mutationFn: (values: HealthProfileFormValues) =>
			healthProfileService.updateHealthProfile(values, profile?.version ?? 0),
		onSuccess: (saved) => {
			if (!updateCache(saved)) return;
			form.reset(formValues(saved));
			toast.success("Đã lưu hồ sơ sức khỏe.");
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const consent = useMutation({
		mutationFn: (grant: boolean) =>
			grant ? healthProfileService.grantConsent() : healthProfileService.revokeConsent(),
		onSuccess: (saved) => {
			if (!updateCache(saved)) return;
			form.setValue("isConsentGranted", saved.consent.isConsentGranted, { shouldDirty: false });
			toast.success(
				saved.consent.isConsentGranted
					? "Đã cho phép chia sẻ hồ sơ sức khỏe và phân tích gợi ý chuyến đi."
					: "Đã thu hồi quyền chia sẻ hồ sơ sức khỏe."
			);
		},
		onError: (error) => toast.error(errorMessage(error)),
	});
	const isSubmitting = save.isPending || consent.isPending;
	const canChange = profile?.accountStatus === "ACTIVE" && !isSubmitting;
	return {
		profile,
		form,
		isLoading: query.isLoading,
		isSubmitting,
		apiError: query.error
			? errorMessage(query.error)
			: save.error instanceof HttpError && save.error.status === 409
				? errorMessage(save.error)
				: null,
		conflictError: save.error instanceof HttpError && save.error.status === 409,
		isDirty: form.formState.isDirty,
		fetchProfile: async () => {
			const result = await query.refetch();
			if (result.data) {
				form.reset(formValues(result.data));
				save.reset();
			}
		},
		handleAddAllergy: (item: AllergyItem) =>
			form.setValue("allergies", [...(form.getValues("allergies") ?? []), item], {
				shouldDirty: true,
				shouldValidate: true,
			}),
		handleRemoveAllergy: (id: string) =>
			form.setValue(
				"allergies",
				(form.getValues("allergies") ?? []).filter((item) => item.id !== id),
				{ shouldDirty: true, shouldValidate: true }
			),
		handleAddMedicalCondition: (item: MedicalConditionItem) =>
			form.setValue("medicalConditions", [...(form.getValues("medicalConditions") ?? []), item], {
				shouldDirty: true,
				shouldValidate: true,
			}),
		handleRemoveMedicalCondition: (id: string) =>
			form.setValue(
				"medicalConditions",
				(form.getValues("medicalConditions") ?? []).filter((item) => item.id !== id),
				{ shouldDirty: true, shouldValidate: true }
			),
		handleRevokeConsent: () => {
			if (canChange) consent.mutate(false);
		},
		handleGrantConsent: () => {
			if (canChange) consent.mutate(true);
		},
		handleReset: () => {
			if (profile) form.reset(formValues(profile));
			save.reset();
		},
		handleSubmit: form.handleSubmit((values) => {
			if (canChange) save.mutate(values);
		}),
	};
}
