import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type { Path } from "react-hook-form";
import { HttpError } from "../../../core/api";
import { type CamperProfileFormValues, camperProfileSchema } from "../schema/profile.schema";
import { camperProfileService } from "../services/camper-profile.service";
import type { CamperProfileData, LanguageItem } from "../types";

const LOAD_ERROR_MESSAGE =
	"Không thể tải hồ sơ. Vui lòng kiểm tra phiên đăng nhập hoặc thử lại sau.";
const SAVE_ERROR_MESSAGE = "Không thể lưu hồ sơ. Vui lòng kiểm tra thông tin và thử lại.";

type ProfileValidationField =
	| "fullName"
	| "dateOfBirth"
	| "gender"
	| "address"
	| "bio"
	| "emergencyContacts";

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

function isProfileValidationField(field: string): field is ProfileValidationField {
	return ["fullName", "dateOfBirth", "gender", "address", "bio", "emergencyContacts"].includes(
		field
	);
}

function getValidationErrors(error: HttpError): BackendValidationError[] {
	if (!isBackendErrorBody(error.errorData) || !Array.isArray(error.errorData.message)) {
		return [];
	}

	return error.errorData.message.filter(
		(item): item is BackendValidationError =>
			typeof item === "object" &&
			item !== null &&
			"field" in item &&
			"errors" in item &&
			typeof item.field === "string" &&
			Array.isArray(item.errors) &&
			item.errors.every((message) => typeof message === "string")
	);
}

function mapProfileError(error: unknown): string {
	if (!(error instanceof HttpError)) {
		return SAVE_ERROR_MESSAGE;
	}

	if (error.status === 401) {
		return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
	}
	if (error.status === 403) {
		return "Tài khoản chưa đủ điều kiện cập nhật hồ sơ.";
	}
	if (error.status === 404) {
		return "Không tìm thấy hồ sơ người dùng.";
	}
	if (error.status === 422) {
		return "Thông tin hồ sơ chưa hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.";
	}
	return error.message || SAVE_ERROR_MESSAGE;
}

function formValuesFromProfile(profile: CamperProfileData): CamperProfileFormValues {
	return {
		fullName: profile.fullName,
		dateOfBirth: profile.dateOfBirth,
		gender: profile.gender,
		address: profile.address,
		bio: profile.bio,
		campingExperienceYears: profile.campingExperienceYears,
		trekkingExperienceDetails: profile.trekkingExperienceDetails,
		emergencyContacts: profile.emergencyContacts.map((contact) => ({
			...contact,
			email: contact.email ?? "",
		})),
	};
}
export function useCamperProfile() {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [languages, setLanguages] = useState<LanguageItem[]>([]);

	const form = useForm<CamperProfileFormValues>({
		resolver: zodResolver(camperProfileSchema),
		defaultValues: {
			fullName: "",
			dateOfBirth: "",
			gender: "male",
			address: "",
			bio: "",
			campingExperienceYears: 0,
			trekkingExperienceDetails: "",
			emergencyContacts: [],
		},
	});

	useEffect(() => {
		let isMounted = true;
		camperProfileService
			.getProfile()
			.then((data) => {
				if (!isMounted) return;
				setProfile(data);
				setLanguages(data.languages);
				form.reset(formValuesFromProfile(data));
				setErrorMessage(null);
				setIsLoading(false);
			})
			.catch((err) => {
				if (!isMounted) return;
				setErrorMessage(err instanceof Error ? mapProfileError(err) : LOAD_ERROR_MESSAGE);
				setIsLoading(false);
			});

		return () => {
			isMounted = false;
		};
	}, [form]);

	const handleAddLanguage = (languageName: string) => {
		if (!languageName.trim()) return;
		const newLang: LanguageItem = {
			id: `lang-${Date.now()}`,
			code: languageName.toLowerCase().slice(0, 2),
			name: languageName.trim(),
		};
		setLanguages((prev) => [...prev, newLang]);
	};

	const handleRemoveLanguage = (id: string) => {
		setLanguages((prev) => prev.filter((lang) => lang.id !== id));
	};

	const handleResetForm = () => {
		if (!profile) return;
		form.reset(formValuesFromProfile(profile));
		setLanguages(profile.languages);
		setErrorMessage(null);
	};

	const onSubmit = async (values: CamperProfileFormValues) => {
		if (isSaving) return;
		if (profile?.accountStatus !== "active") {
			setErrorMessage("Tài khoản chưa đủ điều kiện cập nhật hồ sơ.");
			return;
		}

		setIsSaving(true);
		setSaveSuccessMessage(null);
		setErrorMessage(null);
		try {
			const updated = await camperProfileService.updateProfile(values, languages);
			const nextProfile = {
				...updated,
				campingExperienceYears: values.campingExperienceYears,
				trekkingExperienceDetails: values.trekkingExperienceDetails ?? "",
				languages,
			};
			setProfile(nextProfile);
			form.reset(formValuesFromProfile(nextProfile));
			setSaveSuccessMessage("Hồ sơ đã được lưu thành công!");
			setTimeout(() => setSaveSuccessMessage(null), 3000);
		} catch (err) {
			if (err instanceof HttpError && err.status === 422) {
				for (const validationError of getValidationErrors(err)) {
					if (!isProfileValidationField(validationError.field)) {
						continue;
					}
					const message = validationError.errors[0];
					if (!message) {
						continue;
					}
					form.setError(validationError.field as Path<CamperProfileFormValues>, {
						type: "server",
						message,
					});
				}
			}
			setErrorMessage(mapProfileError(err));
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarChange = async (newAvatarUrl: string) => {
		try {
			const updatedUrl = await camperProfileService.updateAvatar(newAvatarUrl);
			setProfile((prev) => (prev ? { ...prev, avatarUrl: updatedUrl } : prev));
		} catch (err) {
			setErrorMessage(mapProfileError(err));
		}
	};

	const isFormDirty =
		form.formState.isDirty ||
		JSON.stringify(languages) !== JSON.stringify(profile?.languages || []);
	const isProfileEditable = profile?.accountStatus === "active";

	return {
		profile,
		isLoading,
		isSaving,
		isProfileEditable,
		saveSuccessMessage,
		errorMessage,
		form,
		languages,
		isFormDirty,
		handleAddLanguage,
		handleRemoveLanguage,
		handleResetForm,
		handleAvatarChange,
		handleSubmit: form.handleSubmit(onSubmit),
	};
}
