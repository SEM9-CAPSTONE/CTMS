import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppRoleGuard } from "./AppRoleGuard";

describe("AppRoleGuard", () => {
	it("allows access when any granted role matches an allowed role", () => {
		render(
			<AppRoleGuard allowedRoles={["admin"]} currentRoles={["camper", "admin"]}>
				<div>Admin users</div>
			</AppRoleGuard>
		);

		expect(screen.getByText("Admin users")).toBeInTheDocument();
	});

	it("denies access when none of the granted roles match", () => {
		render(
			<AppRoleGuard allowedRoles={["admin"]} currentRoles={["camper"]}>
				<div>Admin users</div>
			</AppRoleGuard>
		);

		expect(screen.queryByText("Admin users")).not.toBeInTheDocument();
		expect(screen.getByText("Truy cập bị từ chối")).toBeInTheDocument();
	});
});
