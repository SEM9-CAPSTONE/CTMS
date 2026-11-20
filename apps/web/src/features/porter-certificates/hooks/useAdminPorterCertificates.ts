import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { queryKeys } from "../../../core/api/queryKeys";
import { porterCertificatesService } from "../services/porter-certificates.service";
import type { AdminRejectCertificateInput, PorterCertificateStatus } from "../types";

export type AdminCertificateFilterStatus = PorterCertificateStatus | "expired";

export function useAdminPorterCertificates() {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<AdminCertificateFilterStatus | undefined>("pending");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [limit] = useState(10);
	const [actionError, setActionError] = useState<string | null>(null);
	const [actionSuccess, setActionSuccess] = useState<string | null>(null);

	const queryFilters = {
		status: status === "expired" ? undefined : status || undefined,
		search: search.trim() || undefined,
		page,
		limit,
	};

	const { data, isLoading, isError, error, refetch } = useQuery({
		queryKey: queryKeys.porterCertificates.adminList(queryFilters),
		queryFn: () => porterCertificatesService.adminGetCertificates(queryFilters),
		staleTime: 30_000,
	});

	const verifyMutation = useMutation({
		mutationFn: (id: string) => porterCertificatesService.adminVerifyCertificate(id),
		onSuccess: () => {
			setActionError(null);
			setActionSuccess("Xác minh chứng chỉ thành công.");
			void queryClient.invalidateQueries({ queryKey: queryKeys.porterCertificates.all });
		},
		onError: (err: Error) => {
			setActionSuccess(null);
			setActionError(err.message || "Xác minh chứng chỉ thất bại.");
		},
	});

	const rejectMutation = useMutation({
		mutationFn: ({ id, input }: { id: string; input: AdminRejectCertificateInput }) =>
			porterCertificatesService.adminRejectCertificate(id, input),
		onSuccess: () => {
			setActionError(null);
			setActionSuccess("Đã từ chối chứng chỉ và thông báo lý do cho người hỗ trợ.");
			void queryClient.invalidateQueries({ queryKey: queryKeys.porterCertificates.all });
		},
		onError: (err: Error) => {
			setActionSuccess(null);
			setActionError(err.message || "Từ chối chứng chỉ thất bại.");
		},
	});

	const rawItems = Array.isArray(data) ? data : [];
	const filtered = rawItems.filter((item) => {
		if (status === "expired") {
			if (!item.isExpired) return false;
		} else if (status === "verified") {
			if (item.status !== "verified" || item.isExpired) return false;
		} else if (status === "pending") {
			if (item.status !== "pending") return false;
		} else if (status === "rejected") {
			if (item.status !== "rejected") return false;
		}

		if (search.trim()) {
			const s = search.toLowerCase();
			const matchName = item.name.toLowerCase().includes(s);
			const matchPorter = item.porter?.fullName?.toLowerCase().includes(s);
			const matchNumber = item.certificateNumber?.toLowerCase().includes(s);
			if (!matchName && !matchPorter && !matchNumber) return false;
		}
		return true;
	});

	const startIndex = (page - 1) * limit;
	const paginated = filtered.slice(startIndex, startIndex + limit);

	return {
		data: paginated,
		total: filtered.length,
		page,
		limit,
		isLoading,
		errorMessage: actionError || (isError ? (error as Error).message : null),
		successMessage: actionSuccess,
		status,
		setStatus: (newStatus: AdminCertificateFilterStatus | undefined) => {
			setStatus(newStatus);
			setPage(1);
		},
		search,
		setSearch: (newSearch: string) => {
			setSearch(newSearch);
			setPage(1);
		},
		setPage,
		clearMessages: () => {
			setActionError(null);
			setActionSuccess(null);
		},
		verifyCertificate: verifyMutation.mutateAsync,
		isVerifying: verifyMutation.isPending,
		rejectCertificate: rejectMutation.mutateAsync,
		isRejecting: rejectMutation.isPending,
		reload: refetch,
	};
}
