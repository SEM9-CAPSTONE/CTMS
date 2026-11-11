import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { bankAccountService } from "../services/bank-account.service";
import type { CreateBankAccountInput } from "../types";

export function useBankAccounts() {
	return useQuery({
		queryKey: queryKeys.bankAccounts.all,
		queryFn: () => bankAccountService.getAll(),
	});
}

export function useAddBankAccount() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (input: CreateBankAccountInput) => bankAccountService.create(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.bankAccounts.all,
			});
		},
	});
}

export function useDeleteBankAccount() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => bankAccountService.delete(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.bankAccounts.all,
			});
		},
	});
}

export function useSetDefaultBankAccount() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => bankAccountService.setDefault(id),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.bankAccounts.all,
			});
		},
	});
}
