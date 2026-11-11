import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../../../core/api";
import { EDITABLE_VERIFICATION_STATUSES, PORTER_VERIFICATION_MAX_DOCUMENTS } from "../constants";
import { porterVerificationService } from "../services/porter-verification.service";
import type { PorterVerification } from "../types";

function errorMessage(error: unknown, fallback: string): string {
	if (error instanceof HttpError) {
		if (error.status === 413) return "File vượt quá dung lượng 5MB cho phép.";
		if (error.message) return error.message;
	}
	return fallback;
}

export function usePorterVerification() {
	const [verification, setVerification] = useState<PorterVerification | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [uploadingCount, setUploadingCount] = useState(0);
	const [removingId, setRemovingId] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const reload = useCallback(async () => {
		setIsLoading(true);
		setLoadError(null);
		try {
			setVerification(await porterVerificationService.getMine());
		} catch (error) {
			setLoadError(errorMessage(error, "Không tải được hồ sơ xác minh. Vui lòng thử lại."));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	const documents = verification?.documents ?? [];
	const isEditable = verification ? EDITABLE_VERIFICATION_STATUSES.has(verification.status) : false;
	const remainingSlots = Math.max(0, PORTER_VERIFICATION_MAX_DOCUMENTS - documents.length);

	const uploadFiles = async (files: File[]) => {
		setActionError(null);
		const batch = files.slice(0, remainingSlots);
		if (files.length > batch.length) {
			setActionError(`Chỉ được tải tối đa ${PORTER_VERIFICATION_MAX_DOCUMENTS} file.`);
		}
		for (const file of batch) {
			setUploadingCount((count) => count + 1);
			try {
				const uploaded = await porterVerificationService.uploadDocument(file);
				setVerification((current) =>
					current ? { ...current, documents: [...current.documents, uploaded] } : current
				);
			} catch (error) {
				setActionError(errorMessage(error, `Tải "${file.name}" thất bại. Vui lòng thử lại.`));
			} finally {
				setUploadingCount((count) => count - 1);
			}
		}
	};

	const removeDocument = async (documentId: string) => {
		setActionError(null);
		setRemovingId(documentId);
		try {
			await porterVerificationService.deleteDocument(documentId);
			setVerification((current) =>
				current
					? { ...current, documents: current.documents.filter((doc) => doc.id !== documentId) }
					: current
			);
		} catch (error) {
			setActionError(errorMessage(error, "Không xóa được tài liệu. Vui lòng thử lại."));
		} finally {
			setRemovingId(null);
		}
	};

	const submit = async (): Promise<boolean> => {
		setActionError(null);
		setIsSubmitting(true);
		try {
			setVerification(await porterVerificationService.submit());
			return true;
		} catch (error) {
			setActionError(errorMessage(error, "Không nộp được hồ sơ. Vui lòng thử lại."));
			return false;
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		verification,
		documents,
		isLoading,
		loadError,
		actionError,
		setActionError,
		isEditable,
		remainingSlots,
		isUploading: uploadingCount > 0,
		removingId,
		isSubmitting,
		reload,
		uploadFiles,
		removeDocument,
		submit,
	};
}
