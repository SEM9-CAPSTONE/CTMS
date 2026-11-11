import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Heading, Text } from "./Typography";

describe("Typography components", () => {
	it("renders Heading with default h2 level", () => {
		render(<Heading>Tiêu đề kiểm thử</Heading>);
		const el = screen.getByRole("heading", { level: 2 });
		expect(el).toBeInTheDocument();
		expect(el).toHaveTextContent("Tiêu đề kiểm thử");
	});

	it("renders Heading with h1 level", () => {
		render(<Heading level={1}>Trang chủ</Heading>);
		const el = screen.getByRole("heading", { level: 1 });
		expect(el).toBeInTheDocument();
		expect(el.tagName).toBe("H1");
	});

	it("renders Text as paragraph by default", () => {
		render(<Text variant="body">Nội dung mô tả</Text>);
		const el = screen.getByText("Nội dung mô tả");
		expect(el.tagName).toBe("P");
	});

	it("renders Text as span when specified", () => {
		render(
			<Text as="span" variant="caption">
				Ghi chú phụ
			</Text>
		);
		const el = screen.getByText("Ghi chú phụ");
		expect(el.tagName).toBe("SPAN");
	});
});
