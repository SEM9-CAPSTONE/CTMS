import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { adminRefundsService } from "../services/admin-refunds.service";

export function useApproveRefund() {
	const client = useQueryClient();
	return useMutation({
		mutationFn: ({ id, note }: { id: string; note?: string }) =>
			adminRefundsService.approve(id, { note }),
		onSuccess: () => {
			void client.invalidateQueries({ queryKey: queryKeys.adminRefunds.all });
			void client.invalidateQueries({ queryKey: queryKeys.settlements.all });
		},
	});
}
