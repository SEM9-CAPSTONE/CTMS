import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { ToastProvider } from "../../../shared/components/Toast";
import { TERMS_OUTDATED_CODE } from "../constants";
import type { MyTermsStatus, TermsVersionDetail } from "../types";
import { TermsReconsentModal } from "./TermsReconsentModal";

const STATUS: MyTermsStatus = {
	currentVersion: "1.1",
	currentTitle: "Điều khoản và Điều kiện sử dụng CTMS",
	currentEffectiveDate: "2026-12-01",
	currentSummary: "Cập nhật quy trình hoàn tiền và an toàn trekking.",
	requiresReconsent: true,
	acceptedCurrentVersion: false,
	needsReconsent: true,
	latestAcceptance: {
		id: "acc-old",
		version: "1.0",
		acceptedAt: "2026-11-27T09:00:00.000Z",
		source: "registration",
		platform: "mobile",
	},
	acceptanceHistory: [],
};

const TERMS_DETAIL: TermsVersionDetail = {
	id: "v11-id",
	version: "1.1",
	title: "Điều khoản và Điều kiện sử dụng CTMS",
	summary: STATUS.currentSummary,
	effectiveDate: "2026-12-01",
	isActive: true,
	requiresReconsent: true,
	publishedAt: "2026-12-01T00:00:00.000Z",
	sections: [
		{
			number: 1,
			slug: "quy-dinh-chung",
			title: "Quy định chung",
			subsections: [{ code: "1.1", title: "Phạm vi áp dụng", body: "Nội dung phiên bản 1.1." }],
		},
	],
};

describe("TermsReconsentModal", () => {
	it("supports 'Để sau' without calling onAccept", async () => {
		const user = userEvent.setup();
		const onDefer = vi.fn();
		const onAccept = vi.fn();

		render(
			<ToastProvider>
				<TermsReconsentModal
					isOpen
					status={STATUS}
					termsDetail={TERMS_DETAIL}
					isLoadingTerms={false}
					isTermsError={false}
					onRetryLoadTerms={vi.fn()}
					onDefer={onDefer}
					onAccept={onAccept}
					isAccepting={false}
					onDone={vi.fn()}
				/>
			</ToastProvider>
		);

		expect(screen.getByText("Cập nhật Điều khoản sử dụng")).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Để sau" }));
		expect(onDefer).toHaveBeenCalledTimes(1);
		expect(onAccept).not.toHaveBeenCalled();
	});

	it("walks through 'Xem và đồng ý', requires reading/checking, and displays confirmed version & date", async () => {
		const user = userEvent.setup();
		const onAccept = vi.fn().mockResolvedValueOnce({
			accepted: true,
			version: "1.1",
			effectiveDate: "2026-12-01",
			acceptedAt: "2026-12-02T10:00:00.000Z",
			alreadyAccepted: false,
		});
		const onDone = vi.fn();

		render(
			<ToastProvider>
				<TermsReconsentModal
					isOpen
					status={STATUS}
					termsDetail={TERMS_DETAIL}
					isLoadingTerms={false}
					isTermsError={false}
					onRetryLoadTerms={vi.fn()}
					onDefer={vi.fn()}
					onAccept={onAccept}
					isAccepting={false}
					onDone={onDone}
				/>
			</ToastProvider>
		);

		await user.click(screen.getByRole("button", { name: "Xem và đồng ý" }));
		expect(screen.getByText("1. Quy định chung")).toBeInTheDocument();

		const confirmBtn = screen.getByRole("button", { name: "Xác nhận đồng ý" });
		expect(confirmBtn).toBeDisabled();

		await user.click(screen.getByRole("checkbox"));
		expect(confirmBtn).toBeEnabled();
		await user.click(confirmBtn);

		await waitFor(() => expect(onAccept).toHaveBeenCalledWith("1.1"));
		expect(await screen.findByText("Đã đồng ý điều khoản")).toBeInTheDocument();
		expect(screen.getAllByText(/v1\.1/).length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText(/02\/12\/2026/).length).toBeGreaterThanOrEqual(1);

		await user.click(screen.getByRole("button", { name: "Tiếp tục sử dụng" }));
		expect(onDone).toHaveBeenCalledTimes(1);
	});

	it("handles 409 TERMS_VERSION_OUTDATED by resetting checkbox and triggering reload", async () => {
		const user = userEvent.setup();
		const onRetryLoadTerms = vi.fn();
		const onAccept = vi.fn().mockRejectedValueOnce(
			new HttpError("Conflict", 409, {
				statusCode: 409,
				code: TERMS_OUTDATED_CODE,
				currentVersion: "1.2",
			})
		);

		render(
			<ToastProvider>
				<TermsReconsentModal
					isOpen
					status={STATUS}
					termsDetail={TERMS_DETAIL}
					isLoadingTerms={false}
					isTermsError={false}
					onRetryLoadTerms={onRetryLoadTerms}
					onDefer={vi.fn()}
					onAccept={onAccept}
					isAccepting={false}
					onDone={vi.fn()}
				/>
			</ToastProvider>
		);

		await user.click(screen.getByRole("button", { name: "Xem và đồng ý" }));
		const checkbox = screen.getByRole("checkbox");
		await user.click(checkbox);
		await user.click(screen.getByRole("button", { name: "Xác nhận đồng ý" }));

		expect(await screen.findByText(/vừa được cập nhật phiên bản mới hơn/i)).toBeInTheDocument();
		expect(checkbox).not.toBeChecked();
		expect(onRetryLoadTerms).toHaveBeenCalledTimes(1);
	});
});
