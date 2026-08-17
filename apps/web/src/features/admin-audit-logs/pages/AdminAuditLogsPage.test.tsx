import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminAuditLogsService } from "../services/admin-audit-logs.service";
import { AdminAuditLogsPage } from "./AdminAuditLogsPage";

vi.mock("../services/admin-audit-logs.service", () => ({
	adminAuditLogsService: {
		getAuditLogs: vi.fn(),
	},
}));

describe("AdminAuditLogsPage", () => {
	const mockLogs = [
		{
			id: "log-1",
			actorId: "actor-1",
			action: "auth.login",
			targetType: "user",
			targetId: "target-1",
			before: null,
			after: null,
			reason: null,
			createdAt: "2026-08-01T12:00:00.000Z",
		},
	];

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("renders loading spinner on initialization", async () => {
		vi.mocked(adminAuditLogsService.getAuditLogs).mockReturnValue(new Promise(() => {}));

		render(<AdminAuditLogsPage />);

		expect(screen.getByText(/Đang tải nhật ký.../i)).toBeInTheDocument();
	});

	it("renders table with logs on success", async () => {
		vi.mocked(adminAuditLogsService.getAuditLogs).mockResolvedValue({
			items: mockLogs,
			pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
		});

		render(<AdminAuditLogsPage />);

		await waitFor(() => {
			expect(screen.getByText("auth.login")).toBeInTheDocument();
		});

		expect(screen.getByText("actor-1")).toBeInTheDocument();
		expect(screen.getByText("target-1")).toBeInTheDocument();
	});

	it("renders empty state when there are no logs", async () => {
		vi.mocked(adminAuditLogsService.getAuditLogs).mockResolvedValue({
			items: [],
			pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
		});

		render(<AdminAuditLogsPage />);

		await waitFor(() => {
			expect(screen.getByText("Không tìm thấy nhật ký phù hợp")).toBeInTheDocument();
		});
	});

	it("renders error message on API failure", async () => {
		vi.mocked(adminAuditLogsService.getAuditLogs).mockRejectedValue(new Error("API Error"));

		render(<AdminAuditLogsPage />);

		await waitFor(() => {
			expect(screen.getByRole("alert")).toBeInTheDocument();
		});

		expect(screen.getByText(/Không thể kết nối đến hệ thống/i)).toBeInTheDocument();
	});
});
