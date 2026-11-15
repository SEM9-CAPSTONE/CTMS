import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { reportsService } from "../services/reports.service";
import { descriptionError } from "../utils/report-input";
import { useReportSubmission } from "./useReportSubmission";

const context = { targetId: "review", label: "Đánh giá", comment: null, createdAt: "" };
const draft = { reportType: "dangerous_content" as const, description: "Đường xuống bãi đá trơn." };

afterEach(() => {
	sessionStorage.clear();
	vi.restoreAllMocks();
});

function setup() {
	const client = new QueryClient();
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	);
	return renderHook(() => useReportSubmission("host", context, vi.fn()), { wrapper });
}

it("rotates the key after an idempotency conflict and preserves it after a network error", async () => {
	const create = vi
		.spyOn(reportsService, "create")
		.mockRejectedValueOnce(new HttpError("Conflict", 409, { code: "REPORT_IDEMPOTENCY_CONFLICT" }))
		.mockRejectedValue(new TypeError("Network unavailable"));
	const { result } = setup();
	act(() => result.current.change(draft));
	for (let i = 0; i < 3; i++) await act(async () => result.current.submit());
	const keys = create.mock.calls.map(([request]) => request.idempotencyKey);
	expect(keys).toHaveLength(3);
	expect(keys[1]).not.toBe(keys[0]);
	expect(keys[2]).toBe(keys[1]);
});

it("restores the account draft and request key after an expired session", async () => {
	const create = vi
		.spyOn(reportsService, "create")
		.mockRejectedValue(new HttpError("Expired", 401, {}));
	const first = setup();
	act(() => first.result.current.change(draft));
	await act(async () => first.result.current.submit());
	first.unmount();
	const second = setup();
	expect(second.result.current.draft.description).toBe(draft.description);
	await act(async () => second.result.current.submit());
	expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
});

it("counts trimmed Vietnamese combining marks and emoji as Unicode code points", () => {
	const boundary = `${"a\u0301🙂".repeat(333)}Đ`;
	expect(descriptionError(`  ${boundary}  `)).toBeNull();
	expect(descriptionError(`${boundary}🙂`)).toMatch(/1.000/);
});

it("ignores concurrent clicks and reuses the key after a 503", async () => {
	const create = vi
		.spyOn(reportsService, "create")
		.mockRejectedValue(new HttpError("Unavailable", 503, {}));
	const { result } = setup();
	act(() => result.current.change(draft));
	await act(async () => {
		await Promise.all([result.current.submit(), result.current.submit()]);
	});
	expect(create).toHaveBeenCalledTimes(1);
	await act(async () => result.current.submit());
	expect(create.mock.calls[1][0]).toEqual(create.mock.calls[0][0]);
});
