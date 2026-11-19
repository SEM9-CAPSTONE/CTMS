import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { HttpError, queryKeys } from "../../core/api";
import { getStoredAuthUser } from "../auth/utils/tokenStorage";

const identity = () => getStoredAuthUser()?.id ?? "";
export const currentReadIdentity = identity;
function subscribe(notify: () => void) {
	window.addEventListener("storage", notify);
	window.addEventListener("focus", notify);
	window.addEventListener("ctms-auth-user-changed", notify);
	return () => {
		window.removeEventListener("storage", notify);
		window.removeEventListener("focus", notify);
		window.removeEventListener("ctms-auth-user-changed", notify);
	};
}
export const isReputationAccessError = (error: unknown) =>
	error instanceof HttpError && [401, 403, 404].includes(error.status);

export function useReadIdentity() {
	return useSyncExternalStore(subscribe, identity, () => "");
}

/** A denied read replaces cached content; transport errors keep the last good snapshot. */
export function useAuthorizedRead<T>(
	scope: readonly unknown[],
	load: () => Promise<T>,
	interval?: number
) {
	const actor = useReadIdentity();
	const client = useQueryClient();
	const key = queryKeys.reputation.authorized(scope, actor);
	const query = useQuery<{ data: T | undefined; denied?: HttpError }>({
		queryKey: key,
		queryFn: async () => {
			try {
				const data = await load();
				if (identity() !== actor) throw new Error("Phiên đăng nhập đã thay đổi.");
				return { data };
			} catch (error) {
				if (identity() === actor && isReputationAccessError(error)) {
					return { data: undefined, denied: error as HttpError };
				}
				throw error;
			}
		},
		retry: false,
		staleTime: 15_000,
		refetchInterval: interval,
	});
	// The scope is constant for each reader; discard its cache when the viewer changes/leaves.
	const serialized = JSON.stringify(key);
	useEffect(
		() => () => {
			const oldKey: readonly unknown[] = JSON.parse(serialized);
			void client.cancelQueries({ queryKey: oldKey, exact: true });
			client.removeQueries({ queryKey: oldKey, exact: true });
		},
		[client, serialized]
	);
	return { ...query, data: query.data?.data, error: query.data?.denied ?? query.error };
}
