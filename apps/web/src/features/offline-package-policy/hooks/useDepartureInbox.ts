import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HttpError } from "../../../core/api/httpClient";
import { queryKeys } from "../../../core/api/queryKeys";
import { packagePolicyService } from "../services/package-policy.service";

const INBOX_POLL_MS = 60_000;
export function useDepartureInbox(actor: string) {
	const client = useQueryClient();
	const key = queryKeys.packageDeparture.inbox(actor);
	const inbox = useQuery({
		queryKey: key,
		queryFn: ({ signal }) => packagePolicyService.list(signal),
		refetchOnMount: "always",
		refetchOnWindowFocus: "always",
		refetchInterval: INBOX_POLL_MS,
		retry: false,
		gcTime: 0,
	});
	const read = useMutation({
		mutationFn: packagePolicyService.read,
		onSuccess: () => client.invalidateQueries({ queryKey: key }),
	});
	const forbidden = inbox.error instanceof HttpError && [401, 403].includes(inbox.error.status);
	return { inbox, read, forbidden };
}

export function useDepartureStatus(actor: string, trip: string) {
	return useQuery({
		queryKey: queryKeys.packageDeparture.status(actor, trip),
		queryFn: ({ signal }) => packagePolicyService.status(trip, signal),
		refetchOnMount: "always",
		refetchOnWindowFocus: "always",
		refetchInterval: INBOX_POLL_MS,
		retry: false,
		gcTime: 0,
	});
}
