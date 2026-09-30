import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { HeaderNav } from "./HeaderNav";

describe("HeaderNav", () => {
	it("shows login and register buttons for an anonymous visitor", () => {
		const onNavigateToLogin = vi.fn();
		const onNavigateToRegister = vi.fn();
		render(
			<HeaderNav
				onNavigateToLogin={onNavigateToLogin}
				onNavigateToRegister={onNavigateToRegister}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
		fireEvent.click(screen.getByRole("button", { name: "Đăng ký" }));

		expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
		expect(onNavigateToRegister).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: /Vào Dashboard/ })).toBeNull();
	});

	it("shows only the dashboard button for a signed-in visitor", () => {
		const onNavigateToDashboard = vi.fn();
		render(
			<HeaderNav
				onNavigateToLogin={vi.fn()}
				onNavigateToRegister={vi.fn()}
				onNavigateToDashboard={onNavigateToDashboard}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: /Vào Dashboard/ }));

		expect(onNavigateToDashboard).toHaveBeenCalledTimes(1);
		expect(screen.queryByRole("button", { name: "Đăng nhập" })).toBeNull();
		expect(screen.queryByRole("button", { name: "Đăng ký" })).toBeNull();
	});
});
