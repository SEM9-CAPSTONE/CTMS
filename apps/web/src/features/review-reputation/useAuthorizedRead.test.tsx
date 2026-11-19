import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../core/api";
import { type StoredAuthUser, setStoredAuthUser } from "../auth/utils/tokenStorage";
import { useAuthorizedRead } from "./useAuthorizedRead";

const user = (id: string) =>
	({
		id,
		role: "host",
		status: "active",
		email: null,
		phone: null,
		createdAt: "",
	}) satisfies StoredAuthUser;
const scope = ["trips", "porter-requests", "host"] as const;
function setup(load: () => Promise<string[]>) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return { client, ...renderHook(() => useAuthorizedRead(scope, load), { wrapper }) };
}
describe("account-scoped reputation reads", () => {
	beforeEach(() => {
		localStorage.clear();
		setStoredAuthUser(user("a"));
	});
	it("keeps good data on network/5xx refresh failures and retries", async () => {
		const load = vi.fn().mockResolvedValue(["Nguyễn Minh Sơn"]);
		const { result } = setup(load);
		await waitFor(() => expect(result.current.data).toEqual(["Nguyễn Minh Sơn"]));
		load.mockRejectedValue(new HttpError("failure", 503, {}));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.error).toBeTruthy());
		expect(result.current.data).toEqual(["Nguyễn Minh Sơn"]);
		load.mockResolvedValue(["Trần Quốc Huy"]);
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.data).toEqual(["Trần Quốc Huy"]));
	});
	it.each([401, 403, 404])("clears data and its cache on access failure %i", async (status) => {
		const load = vi.fn().mockResolvedValue(["Nguyễn Minh Sơn"]);
		const { result, client } = setup(load);
		await waitFor(() => expect(result.current.data).toHaveLength(1));
		load.mockRejectedValue(new HttpError("denied", status, {}));
		await act(async () => {
			await result.current.refetch();
		});
		await waitFor(() => expect(result.current.data).toBeUndefined());
		expect(result.current.error).toBeInstanceOf(HttpError);
		expect(JSON.stringify(client.getQueryData([...scope, "viewer", "a"]))).not.toContain(
			"Nguyễn Minh Sơn"
		);
	});
	it("discards the old account's cache and late response during a switch", async () => {
		let finish!: (value: string[]) => void;
		const load = vi
			.fn()
			.mockImplementationOnce(
				() =>
					new Promise<string[]>((resolve) => {
						finish = resolve;
					})
			)
			.mockResolvedValue(["Trần Quốc Huy"]);
		const { result, client } = setup(load);
		await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
		act(() => setStoredAuthUser(user("b")));
		await waitFor(() => expect(result.current.data).toEqual(["Trần Quốc Huy"]));
		await act(async () => finish(["Nguyễn Minh Sơn"]));
		expect(result.current.data).toEqual(["Trần Quốc Huy"]);
		expect(client.getQueryData([...scope, "viewer", "a"])).toBeUndefined();
	});
});
