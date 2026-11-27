import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "../../../core/api";
import { queryKeys } from "../../../core/api/queryKeys";
import { platformBankAccountService } from "../services/platform-bank-account.service";
import type { PlatformBankAccountInput } from "../types";

type Service = typeof platformBankAccountService;

/** Admin: the account Hosts transfer unpaid weather penalties to. */
export function usePlatformBankAccount(service: Service = platformBankAccountService) {
	return useQuery({
		queryKey: queryKeys.platformBankAccount.admin,
		queryFn: service.get,
		select: (data) => data.account,
	});
}

export function useSavePlatformBankAccount(service: Service = platformBankAccountService) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (input: PlatformBankAccountInput) => service.save(input),
		onSuccess: (account) => {
			client.setQueryData(queryKeys.platformBankAccount.admin, { account });
			void client.invalidateQueries({ queryKey: ["weather", "penalties"] });
		},
	});
}

export function platformBankAccountErrorMessage(error: unknown): string {
	if (error instanceof HttpError) {
		if (error.status === 403) return "Bạn không có quyền cấu hình tài khoản nhận tiền.";
		if (error.status === 422) return "Thông tin tài khoản chưa hợp lệ. Vui lòng kiểm tra lại.";
	}
	return "Không lưu được tài khoản nhận tiền. Vui lòng thử lại.";
}
