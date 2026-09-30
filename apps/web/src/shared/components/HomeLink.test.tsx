import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeLink } from "./HomeLink";

describe("HomeLink", () => {
	beforeEach(() => {
		window.history.replaceState({}, "", "/admin/users");
	});

	it("navigates to the home page in-app on a plain click", () => {
		const onPopState = vi.fn();
		window.addEventListener("popstate", onPopState);

		render(
			<HomeLink>
				<span>CTMS</span>
			</HomeLink>
		);
		fireEvent.click(screen.getByRole("link", { name: "Về trang chủ CTMS" }));

		expect(window.location.pathname).toBe("/");
		expect(onPopState).toHaveBeenCalledTimes(1);
		window.removeEventListener("popstate", onPopState);
	});

	it("leaves Ctrl+click to the browser so it can open a new tab", () => {
		render(
			<HomeLink>
				<span>CTMS</span>
			</HomeLink>
		);
		const link = screen.getByRole("link", { name: "Về trang chủ CTMS" });

		expect(link).toHaveAttribute("href", "/");
		const wasNotPrevented = fireEvent.click(link, { ctrlKey: true });

		expect(wasNotPrevented).toBe(true);
		expect(window.location.pathname).toBe("/admin/users");
	});
});
