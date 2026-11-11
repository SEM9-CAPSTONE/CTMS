import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Path, useForm } from "react-hook-form";
import { HttpError } from "../../../core/api";
import { DEFAULT_VIRTUAL_PORTER_PROFILE } from "../constants";
import { type PorterProfileFormValues, porterProfileSchema } from "../schema/porter-profile.schema";
import { porterProfileService } from "../services/porter-profile.service";
import type { PorterProfile, UpdatePorterProfileInput } from "../types";

const LOAD_ERROR_MESSAGE = "Không thể tải hồ sơ Porter. Vui lòng kiểm tra kết nối và thử lại.";
const SAVE_ERROR_MESSAGE = "Không thể lưu hồ sơ Porter. Vui lòng kiểm tra lại thông tin.";

interface BackendValidationError {
	field: string;
	errors: string[];
}

interface BackendErrorBody {
	message?: string | BackendValidationError[];
}

function isBackendErrorBody(value: unknown): value is BackendErrorBody {
	return typeof value === "object" && value !== null && "message" in value;
}

function getValidationErrors(error: HttpError): BackendValidationError[] {
	if (!isBackendErrorBody(error.errorData)) {
		return [];
	}

	if (Array.isArray(error.errorData.message)) {
		const result: BackendValidationError[] = [];
		for (const item of error.errorData.message) {
			if (
				typeof item === "object" &&
				item !== null &&
				"field" in item &&
				"errors" in item &&
				typeof item.field === "string" &&
				Array.isArray(item.errors)
			) {
				result.push(item as BackendValidationError);
			} else if (typeof item === "string") {
				const itemStr: string = item;
				const knownFields = [
					"experienceYears",
					"certifications",
					"languages",
					"availabilityStatus",
				];
				const matchedField = knownFields.find((f) => itemStr.includes(f));
				if (matchedField) {
					result.push({ field: matchedField, errors: [itemStr] });
				}
			}
		}
		return result;
	}

	return [];
}

function mapProfileError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return SAVE_ERROR_MESSAGE;
	}

	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Bạn không có quyền cập nhật hồ sơ Porter.";
	}
	if (error.status === 404) {
		return "Không tìm thấy hồ sơ Porter.";
	}
	if (error.status === 409) {
		return "Hồ sơ đã được chỉnh sửa ở phiên khác. Dữ liệu mới nhất đã được tải lại.";
	}
	if (error.status === 422) {
		return "Thông tin hồ sơ không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.";
	}
	return error.message || SAVE_ERROR_MESSAGE;
}

function formValuesFromProfile(profile: PorterProfile): PorterProfileFormValues {
	return {
		experienceYears: profile.experienceYears,
		certifications: [...profile.certifications],
		languages: [...profile.languages],
		availabilityStatus: profile.availabilityStatus,
	};
}

export function usePorterProfile() {
	const [profile, setProfile] = useState<PorterProfile | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [conflictMessage, setConflictMessage] = useState<string | null>(null);
	const requestSequence = useRef(0);

	const form = useForm<PorterProfileFormValues>({
		resolver: zodResolver(porterProfileSchema),
		defaultValues: formValuesFromProfile(DEFAULT_VIRTUAL_PORTER_PROFILE),
	});

	const loadProfile = useCallback(async () => {
		const sequence = ++requestSequence.current;
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const data = await porterProfileService.getProfile();
			if (sequence === requestSequence.current) {
				setProfile(data);
				form.reset(formValuesFromProfile(data));
			}
		} catch (err) {
			if (sequence === requestSequence.current) {
				setErrorMessage(err instanceof Error ? mapProfileError(err) : LOAD_ERROR_MESSAGE);
			}
		} finally {
			if (sequence === requestSequence.current) {
				setIsLoading(false);
			}
		}
	}, [form]);

	useEffect(() => {
		void loadProfile();
		return () => {
			requestSequence.current += 1;
		};
	}, [loadProfile]);

	const handleResetForm = () => {
		if (profile) {
			form.reset(formValuesFromProfile(profile));
		} else {
			form.reset(formValuesFromProfile(DEFAULT_VIRTUAL_PORTER_PROFILE));
		}
		setErrorMessage(null);
		setConflictMessage(null);
	};

	const saveProfile = async (values: PorterProfileFormValues) => {
		if (isSaving) return;

		setIsSaving(true);
		setSaveSuccessMessage(null);
		setErrorMessage(null);
		setConflictMessage(null);

		const payload: UpdatePorterProfileInput = {
			experienceYears: values.experienceYears,
			certifications: values.certifications,
			languages: values.languages,
			availabilityStatus: values.availabilityStatus,
		};

		// Only send expectedVersion if the profile is persisted (version > 0)
		if (profile && profile.version > 0) {
			payload.expectedVersion = profile.version;
		}

		try {
			const updated = await porterProfileService.updateProfile(payload);
			setProfile(updated);
			form.reset(formValuesFromProfile(updated));
			setSaveSuccessMessage("Hồ sơ Porter đã được lưu thành công!");
			setTimeout(() => setSaveSuccessMessage(null), 4000);
		} catch (err) {
			if (err instanceof HttpError) {
				if (err.status === 409) {
					// Stale conflict: reload latest authoritative data and inform user
					setConflictMessage(
						"Hồ sơ đã được cập nhật ở phiên khác (xung đột phiên bản). Dữ liệu mới nhất đã được tải lại."
					);
					try {
						const latest = await porterProfileService.getProfile();
						setProfile(latest);
						form.reset(formValuesFromProfile(latest));
					} catch {
						// ignore secondary fetch error
					}
					return;
				}

				if (err.status === 422) {
					const fieldErrors = getValidationErrors(err);
					for (const valErr of fieldErrors) {
						if (
							["experienceYears", "certifications", "languages", "availabilityStatus"].includes(
								valErr.field
							)
						) {
							const msg = valErr.errors[0];
							if (msg) {
								form.setError(valErr.field as Path<PorterProfileFormValues>, {
									type: "server",
									message: msg,
								});
							}
						}
					}
				}
			}

			setErrorMessage(mapProfileError(err));
		} finally {
			setIsSaving(false);
		}
	};

	const isDirty = form.formState.isDirty;
	const errors = form.formState.errors;

	return {
		profile,
		isLoading,
		isSaving,
		saveSuccessMessage,
		errorMessage,
		conflictMessage,
		form,
		errors,
		isDirty,
		reload: loadProfile,
		handleResetForm,
		handleSubmit: form.handleSubmit(saveProfile),
		clearMessages: () => {
			setSaveSuccessMessage(null);
			setErrorMessage(null);
			setConflictMessage(null);
		},
	};
}
