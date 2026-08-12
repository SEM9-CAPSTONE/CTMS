import { useCallback, useEffect, useState } from "react";
import { DEFAULT_USER_ACCOUNTS_LIMIT, DEFAULT_USER_ACCOUNTS_PAGE } from "../constants";
import { adminUserAccountsService } from "../services/admin-user-accounts.service";
import type {
	AccountAction,
	UserAccountDetail,
	UserAccountListParams,
	UserAccountSummary,
	UserRole,
	UserStatus,
} from "../types";
import { mapAdminUserAccountsError } from "../utils/admin-user-accounts.utils";

interface PendingAction {
	action: AccountAction;
	user: UserAccountSummary;
}

export function useAdminUserAccounts() {
	const [params, setParams] = useState<UserAccountListParams>({
		page: DEFAULT_USER_ACCOUNTS_PAGE,
		limit: DEFAULT_USER_ACCOUNTS_LIMIT,
	});
	const [searchInput, setSearchInput] = useState("");
	const [users, setUsers] = useState<UserAccountSummary[]>([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: DEFAULT_USER_ACCOUNTS_LIMIT,
		total: 0,
		totalPages: 0,
	});
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null);
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailUser, setDetailUser] = useState<UserAccountDetail | null>(null);
	const [isDetailLoading, setIsDetailLoading] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const loadUsers = useCallback(async () => {
		setIsLoading(true);
		setErrorMessage(null);
		try {
			const result = await adminUserAccountsService.getUsers(params);
			setUsers(result.items);
			setPagination(result.pagination);
		} catch (error) {
			setErrorMessage(mapAdminUserAccountsError(error));
		} finally {
			setIsLoading(false);
		}
	}, [params]);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);
	useEffect(() => {
		adminUserAccountsService
			.getCurrentUser()
			.then((user) => setCurrentUserId(user.id))
			.catch(() => setCurrentUserId(null));
	}, []);

	const submitSearch = () =>
		setParams((current) => ({ ...current, search: searchInput.trim() || undefined, page: 1 }));
	const setRole = (role?: UserRole) => setParams((current) => ({ ...current, role, page: 1 }));
	const setStatus = (status?: UserStatus) =>
		setParams((current) => ({ ...current, status, page: 1 }));
	const setPage = (page: number) => setParams((current) => ({ ...current, page }));
	const resetFilters = () => {
		setSearchInput("");
		setParams({ page: 1, limit: DEFAULT_USER_ACCOUNTS_LIMIT });
	};

	const viewUser = async (user: UserAccountSummary) => {
		setDetailOpen(true);
		setDetailUser(null);
		setIsDetailLoading(true);
		setErrorMessage(null);
		try {
			setDetailUser(await adminUserAccountsService.getUser(user.id));
		} catch (error) {
			setDetailOpen(false);
			setErrorMessage(mapAdminUserAccountsError(error));
		} finally {
			setIsDetailLoading(false);
		}
	};

	const openAction = (user: UserAccountSummary, action: AccountAction) => {
		setActionError(null);
		setPendingAction({ user, action });
	};
	const closeAction = () => {
		if (!isSubmitting) {
			setPendingAction(null);
			setActionError(null);
		}
	};
	const confirmAction = async (reason?: string) => {
		if (!pendingAction || isSubmitting) return;
		setIsSubmitting(true);
		setActionError(null);
		setSuccessMessage(null);
		try {
			const serviceMethod =
				pendingAction.action === "lock"
					? adminUserAccountsService.lockUser
					: adminUserAccountsService.unlockUser;
			const updated = await serviceMethod(pendingAction.user.id, { reason });
			setDetailUser((current) => (current?.id === updated.id ? updated : current));
			setSuccessMessage(
				pendingAction.action === "lock"
					? "Đã khóa tài khoản thành công."
					: "Đã mở khóa tài khoản thành công."
			);
			setPendingAction(null);
			await loadUsers();
		} catch (error) {
			setActionError(mapAdminUserAccountsError(error));
		} finally {
			setIsSubmitting(false);
		}
	};

	return {
		params,
		searchInput,
		users,
		pagination,
		currentUserId,
		isLoading,
		errorMessage,
		successMessage,
		detailOpen,
		detailUser,
		isDetailLoading,
		pendingAction,
		isSubmitting,
		actionError,
		setSearchInput,
		submitSearch,
		setRole,
		setStatus,
		setPage,
		resetFilters,
		reload: loadUsers,
		viewUser,
		closeDetail: () => setDetailOpen(false),
		openAction,
		closeAction,
		confirmAction,
	};
}
