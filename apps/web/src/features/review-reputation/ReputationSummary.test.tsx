import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReputationSummary } from "./ReputationSummary";
import { formatReputationRating, reputationText } from "./reputation";

describe("reputation presentation", () => {
	it.each([
		[4.25, "4,3"],
		[4.35, "4,4"],
		[5, "5,0"],
		[4.24, "4,2"],
	])("rounds %s decimal half-up to %s", (value, expected) => {
		expect(formatReputationRating(Number(value))).toBe(expected);
	});
	it("announces rating and count as one meaningful label", () => {
		render(<ReputationSummary value={{ ratingAverage: 4.25, ratingCount: 12 }} />);
		expect(
			screen.getByRole("img", { name: "Điểm uy tín 4,3 trên 5, 12 đánh giá" })
		).toBeInTheDocument();
		expect(screen.getByText("4,3/5 · 12 đánh giá")).toBeInTheDocument();
	});
	it("distinguishes omitted, empty and a single review", () => {
		const { rerender, container } = render(<ReputationSummary />);
		expect(container).toBeEmptyDOMElement();
		rerender(<ReputationSummary value={{ ratingAverage: null, ratingCount: 0 }} />);
		expect(screen.getByRole("img", { name: "Chưa có đánh giá" })).toBeInTheDocument();
		rerender(<ReputationSummary value={{ ratingAverage: 5, ratingCount: 1 }} />);
		expect(screen.getByText("5,0/5 · 1 đánh giá")).toBeInTheDocument();
		expect(reputationText({ ratingAverage: null, ratingCount: 1 }).visible).toBe(
			"Chưa có dữ liệu uy tín"
		);
	});
});
