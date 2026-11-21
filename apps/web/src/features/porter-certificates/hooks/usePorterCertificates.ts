import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { porterCertificatesService } from "../services/porter-certificates.service";
import type { CreatePorterCertificateInput, UpdatePorterCertificateInput } from "../types";

export function usePorterCertificates() {
	const queryClient = useQueryClient();
	const [actionError, setActionError] = useState<string | null>(null);
	const [actionSuccess, setActionSuccess] = useState<string | null>(null);

	const {
		data: certificates = [],
		isLoading,
		isError,
		error,
		refetch,
	} = useQuery({
		queryKey: queryKeys.porterCertificates.my,
		queryFn: () => porterCertificatesService.getMyCertificates(),
		staleTime: 60_000,
	});

	const createMutation = useMutation({
		mutationFn: (input: CreatePorterCertificateInput) =>
			porterCertificatesService.createCertificate(input),
		onSuccess: () => {
			setActionError(null);
			setActionSuccess("Tải lên chứng chỉ thành công. Đang chờ quản trị viên xác minh.");
			void queryClient.invalidateQueries({ queryKey: queryKeys.porterCertificates.all });
		},
		onError: (err: Error) => {
			setActionSuccess(null);
			setActionError(err.message || "Không thể tải lên chứng chỉ. Vui lòng thử lại.");
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, input }: { id: string; input: UpdatePorterCertificateInput }) =>
			porterCertificatesService.updateCertificate(id, input),
		onSuccess: () => {
			setActionError(null);
			setActionSuccess("Cập nhật chứng chỉ thành công.");
			void queryClient.invalidateQueries({ queryKey: queryKeys.porterCertificates.all });
		},
		onError: (err: Error) => {
			setActionSuccess(null);
			setActionError(err.message || "Không thể cập nhật chứng chỉ. Vui lòng thử lại.");
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => porterCertificatesService.deleteCertificate(id),
		onSuccess: () => {
			setActionError(null);
			setActionSuccess("Đã xóa chứng chỉ thành công.");
			void queryClient.invalidateQueries({ queryKey: queryKeys.porterCertificates.all });
		},
		onError: (err: Error) => {
			setActionSuccess(null);
			setActionError(err.message || "Không thể xóa chứng chỉ. Vui lòng thử lại.");
		},
	});

	return {
		certificates,
		isLoading,
		errorMessage: actionError || (isError ? (error as Error).message : null),
		successMessage: actionSuccess,
		clearMessages: () => {
			setActionError(null);
			setActionSuccess(null);
		},
		createCertificate: createMutation.mutateAsync,
		isCreating: createMutation.isPending,
		updateCertificate: updateMutation.mutateAsync,
		isUpdating: updateMutation.isPending,
		deleteCertificate: deleteMutation.mutateAsync,
		isDeleting: deleteMutation.isPending,
		reload: refetch,
	};
}
