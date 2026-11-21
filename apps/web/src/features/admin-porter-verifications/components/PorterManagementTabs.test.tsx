import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { PorterManagementTabs } from "./PorterManagementTabs";

describe("người hỗ trợ management navigation", () => {
	beforeEach(() => window.history.replaceState({}, "", "/admin/porter-verifications"));
	it("retains both existing routes and identifies the active tab", async () => {
		const user = userEvent.setup();
		render(<PorterManagementTabs active="profiles" />);
		expect(screen.getByRole("link", { name: "Hồ sơ người hỗ trợ" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		const levels = screen.getByRole("link", { name: "Xét cấp độ" });
		expect(levels).toHaveAttribute("href", "/admin/porter-levels?view=requests");
		await user.click(levels);
		expect(window.location.pathname).toBe("/admin/porter-levels");
	});
	it("opens bookmarked level routes without redirecting to profiles", () => {
		window.history.replaceState({}, "", "/admin/porter-levels?request=review-1");
		render(<PorterManagementTabs active="requests" />);
		expect(screen.getByRole("link", { name: "Xét cấp độ" })).toHaveAttribute(
			"aria-current",
			"page"
		);
		expect(window.location.search).toBe("?request=review-1");
	});
});
