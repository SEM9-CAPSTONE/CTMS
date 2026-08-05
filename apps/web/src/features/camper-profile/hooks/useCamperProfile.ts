import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { type CamperProfileFormValues, camperProfileSchema } from "../schema/profile.schema";
import { camperProfileService } from "../services/camper-profile.service";
import type { CamperProfileData, LanguageItem } from "../types";

export function useCamperProfile() {
	const [profile, setProfile] = useState<CamperProfileData | null>(null);
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [isSaving, setIsSaving] = useState<boolean>(false);
	const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
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
				form.reset({
					fullName: data.fullName,
					dateOfBirth: data.dateOfBirth,
					gender: data.gender,
					address: data.address,
					bio: data.bio,
					campingExperienceYears: data.campingExperienceYears,
					trekkingExperienceDetails: data.trekkingExperienceDetails,
				});
				setIsLoading(false);
			})
			.catch((err) => {
				console.error("Failed to load camper profile", err);
				if (isMounted) setIsLoading(false);
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
		form.reset({
			fullName: profile.fullName,
			dateOfBirth: profile.dateOfBirth,
			gender: profile.gender,
			address: profile.address,
			bio: profile.bio,
			campingExperienceYears: profile.campingExperienceYears,
			trekkingExperienceDetails: profile.trekkingExperienceDetails,
		});
		setLanguages(profile.languages);
	};

	const onSubmit = async (values: CamperProfileFormValues) => {
		setIsSaving(true);
		setSaveSuccessMessage(null);
		try {
			const updated = await camperProfileService.updateProfile(values, languages);
			setProfile(updated);
			form.reset(values);
			setSaveSuccessMessage("Hồ sơ đã được lưu thành công!");
			setTimeout(() => setSaveSuccessMessage(null), 3000);
		} catch (err) {
			console.error("Failed to update profile", err);
		} finally {
			setIsSaving(false);
		}
	};

	const handleAvatarChange = async (newAvatarUrl: string) => {
		try {
			const updatedUrl = await camperProfileService.updateAvatar(newAvatarUrl);
			setProfile((prev) => (prev ? { ...prev, avatarUrl: updatedUrl } : prev));
		} catch (err) {
			console.error("Failed to update avatar", err);
		}
	};

	const isFormDirty =
		form.formState.isDirty ||
		JSON.stringify(languages) !== JSON.stringify(profile?.languages || []);

	return {
		profile,
		isLoading,
		isSaving,
		saveSuccessMessage,
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
