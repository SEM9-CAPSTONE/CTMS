import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { porterVerificationService } from "../services/porter-verification.service";
import type { PorterVerification } from "../types";
import { PorterVerificationGate, resetPorterVerificationGateCache } from "./PorterVerificationGate";

vi.mock("../services/porter-verification.service", () => ({
	porterVerificationService: { getMine: vi.fn() },
}));

function status(value: PorterVerification["status"]): PorterVerification {
	return {
		porterId: "porter-1",
		status: value,
		submittedAt: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 1,
		documents: [],
	};
}

describe("PorterVerificationGate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetPorterVerificationGateCache();
	});

	it("renders Porter pages once approved and remembers the approval", async () => {
		vi.mocked(porterVerificationService.getMine).mockResolvedValue(status("approved"));
		const onRequire = vi.fn();
		const { unmount } = render(
			<PorterVerificationGate porterId="porter-1" onRequireVerification={onRequire}>
				<p>Porter page</p>
			</PorterVerificationGate>
		);

		expect(await screen.findByText("Porter page")).toBeInTheDocument();
		unmount();

		render(
			<PorterVerificationGate porterId="porter-1" onRequireVerification={onRequire}>
				<p>Porter page</p>
			</PorterVerificationGate>
		);
		expect(screen.getByText("Porter page")).toBeInTheDocument();
		expect(porterVerificationService.getMine).toHaveBeenCalledTimes(1);
		expect(onRequire).not.toHaveBeenCalled();
	});

	it.each(["pending_documents", "pending_review", "rejected"] as const)(
		"redirects to verification while status is %s",
		async (value) => {
			vi.mocked(porterVerificationService.getMine).mockResolvedValue(status(value));
			const onRequire = vi.fn();
			render(
				<PorterVerificationGate porterId="porter-1" onRequireVerification={onRequire}>
					<p>Porter page</p>
				</PorterVerificationGate>
			);

			await waitFor(() => expect(onRequire).toHaveBeenCalled());
			expect(screen.queryByText("Porter page")).not.toBeInTheDocument();
		}
	);

	it("fails closed when the status cannot be loaded", async () => {
		vi.mocked(porterVerificationService.getMine).mockRejectedValue(new Error("offline"));
		const onRequire = vi.fn();
		render(
			<PorterVerificationGate porterId="porter-1" onRequireVerification={onRequire}>
				<p>Porter page</p>
			</PorterVerificationGate>
		);

		await waitFor(() => expect(onRequire).toHaveBeenCalled());
		expect(screen.queryByText("Porter page")).not.toBeInTheDocument();
	});
});
