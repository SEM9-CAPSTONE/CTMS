import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { survivalDocumentsService } from "../services/survival-documents.service";
import { useSourceFile } from "./useSourceFile";

it("never labels delayed v1 bytes as a newly selected v2 and revokes the private blob", async () => {
	const originalCreate = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
	const originalRevoke = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
	const revoke = vi.fn();
	const create = vi.fn(() => "blob:private-test");
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: create,
	});
	Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
	let finish!: (blob: Blob) => void;
	const newerPdf = new Blob(["Fictional v2 PDF"]);
	const read = vi.spyOn(survivalDocumentsService, "file").mockImplementation((_doc, version) =>
		version === "v1"
			? new Promise((resolve) => {
					finish = resolve;
				})
			: Promise.resolve(newerPdf)
	);
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	try {
		const hook = renderHook(({ id }) => useSourceFile("document", id), {
			wrapper,
			initialProps: { id: "v1" },
		});
		await waitFor(() =>
			expect(read).toHaveBeenCalledWith("document", "v1", expect.any(AbortSignal))
		);
		hook.rerender({ id: "v2" });
		await act(async () => {
			finish(new Blob(["Fictional v1 PDF"]));
		});
		await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
		expect(create).toHaveBeenCalledWith(newerPdf);
		expect(hook.result.current.file.data).toBe(newerPdf);
		hook.unmount();
		expect(revoke).toHaveBeenCalledWith("blob:private-test");
	} finally {
		read.mockRestore();
		if (originalCreate) Object.defineProperty(URL, "createObjectURL", originalCreate);
		else Reflect.deleteProperty(URL, "createObjectURL");
		if (originalRevoke) Object.defineProperty(URL, "revokeObjectURL", originalRevoke);
		else Reflect.deleteProperty(URL, "revokeObjectURL");
	}
});
