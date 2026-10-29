import { describe, expect, it, vi } from "vitest";
import { overviewFixture } from "../../../../tests/fixtures/host-overview";
import { httpClient } from "../../../core/api";
import { hostOverviewService } from "./host-overview.service";

describe("Host overview service contract", () => {
	it("preserves backend values and passes pagination and abort signal to the shared client", async () => {
		const fixture = overviewFixture();
		const get = vi.spyOn(httpClient, "get").mockResolvedValueOnce(fixture);
		const signal = new AbortController().signal;
		try {
			expect(await hostOverviewService.get(2, 5, signal)).toEqual(fixture);
			expect(get).toHaveBeenCalledWith(
				"/host/monitoring/overview",
				{ page: 2, limit: 5 },
				{ signal }
			);
		} finally {
			get.mockRestore();
		}
	});
	it("rejects malformed payloads rather than fabricating empty data or crashing a component", async () => {
		const get = vi.spyOn(httpClient, "get").mockResolvedValueOnce([]);
		try {
			await expect(hostOverviewService.get(1, 5)).rejects.toThrow();
		} finally {
			get.mockRestore();
		}
	});
});
