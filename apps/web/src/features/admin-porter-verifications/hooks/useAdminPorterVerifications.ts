import { useCallback, useEffect, useState } from "react";
import { HttpError } from "../../../core/api";
import type { PorterVerificationStatus } from "../../porter-verification/types";
import { adminPorterVerificationsService } from "../services/admin-porter-verifications.service";
import type {
	AdminPorterVerificationDetail,
	AdminPorterVerificationSummary,
	PorterVerificationListParams,
} from "../types";

const PAGE_SIZE = 20;
const DEFAULT_PARAMS: PorterVerificationListParams = {
	status: "pending_review",
	page: 1,
	limit: PAGE_SIZE,
};

function errorMessage(error: unknown, fallback: string): string {
	return error instanceof HttpError && error.message ? error.message : fallback;
}

export function useAdminPorterVerifications() {
	const [params, setParams] = useState<PorterVerificationListParams>(DEFAULT_PARAMS);
	const [searchInput, setSearchInput] = useState("");
	const [items, setItems] = useState<AdminPorterVerificationSummary[]>([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: PAGE_SIZE,
		total: 0,
		totalPages: 0,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessageText, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);

	const [detail, setDetail] = useState<AdminPorterVerificationDetail | null>(null);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState<string | null>(null);
	const [isReviewing, setIsReviewing] = useState(false);

	const load = useCallback(async (next: PorterVerificationListParams) => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const result = await adminPorterVerificationsService.list(next);
			setItems(result.items);
			setPagination(result.pagination);
		} catch (error) {
			setErrorMessage(errorMessage(error, "Không tải được danh sách hồ sơ Porter."));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void load(params);
	}, [load, params]);

	const openDetail = async (porterId: string) => {
		setIsDetailOpen(true);
		setIsDetailLoading(true);
		setDetail(null);
		setDetailError(null);
		try {
			setDetail(await adminPorterVerificationsService.getDetail(porterId));
		} catch (error) {
			setDetailError(errorMessage(error, "Không tải được hồ sơ Porter."));
		} finally {
			setIsDetailLoading(false);
		}
	};

	const closeDetail = () => {
		if (isReviewing) return;
		setIsDetailOpen(false);
		setDetail(null);
		setDetailError(null);
	};

	const review = async (action: "approve" | "reject", reason?: string): Promise<boolean> => {
		if (!detail) return false;
		setIsReviewing(true);
		setDetailError(null);
		try {
			const updated =
				action === "approve"
					? await adminPorterVerificationsService.approve(detail.porterId)
					: await adminPorterVerificationsService.reject(detail.porterId, reason ?? "");
			setDetail(updated);
			const name = updated.fullName ?? updated.email ?? "Porter";
			setSuccessMessage(
				action === "approve" ? `Đã duyệt hồ sơ của ${name}.` : `Đã từ chối hồ sơ của ${name}.`
			);
			void load(params);
			return true;
		} catch (error) {
			setDetailError(errorMessage(error, "Không xử lý được hồ sơ. Vui lòng thử lại."));
			return false;
		} finally {
			setIsReviewing(false);
		}
	};

	return {
		params,
		items,
		pagination,
		isLoading,
		errorMessage: errorMessageText,
		successMessage,
		searchInput,
		setSearchInput,
		setStatus: (status?: PorterVerificationStatus) =>
			setParams((current) => ({ ...current, status, page: 1 })),
		submitSearch: () =>
			setParams((current) => ({ ...current, search: searchInput.trim() || undefined, page: 1 })),
		resetFilters: () => {
			setSearchInput("");
			setParams(DEFAULT_PARAMS);
		},
		setPage: (page: number) => setParams((current) => ({ ...current, page })),
		reload: () => load(params),
		detail,
		isDetailOpen,
		isDetailLoading,
		detailError,
		isReviewing,
		openDetail,
		closeDetail,
		approve: () => review("approve"),
		reject: (reason: string) => review("reject", reason),
	};
}
