import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { cancellationFixture } from "../test-fixtures";
import { CancellationResultCard } from "./CancellationResultCard";

it.each([
	["pending", "Hoàn tiền đang chờ xử lý, chưa hoàn tất."],
	["succeeded", "Hoàn tiền đã hoàn tất."],
	["failed", "Hoàn tiền thất bại. Đơn đặt chỗ vẫn đã hủy."],
] as const)(
	"displays authoritative %s refund without rounding the money string",
	(status, label) => {
		render(
			<CancellationResultCard
				result={{
					...cancellationFixture,
					refund: { obligationId: "r", amount: "1000000000.01", status },
				}}
			/>
		);
		expect(screen.getByText(label)).toBeVisible();
		expect(screen.getByTestId("cancellation-refund-amount")).toHaveTextContent("1000000000.01");
	}
);
it("does not infer a zero refund or a legacy cancellation timestamp", () => {
	render(
		<CancellationResultCard result={{ ...cancellationFixture, refund: null, cancelledAt: null }} />
	);
	expect(screen.queryByTestId("cancellation-refund-amount")).not.toBeInTheDocument();
	expect(screen.queryByText(/Thời điểm hủy/)).not.toBeInTheDocument();
});
