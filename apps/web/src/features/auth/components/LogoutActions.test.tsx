import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LogoutActions } from "./LogoutActions";

describe("LogoutActions", () => {
	it("logs out from the current device", async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn().mockResolvedValue(undefined);

		render(<LogoutActions onLogout={onLogout} />);

		await user.click(screen.getByRole("button", { name: /đăng xuất thiết bị này/i }));

		await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
		expect(onLogout).toHaveBeenCalledWith(false);
	});

	it("opens confirmation before logging out from all devices", async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn().mockResolvedValue(undefined);

		render(<LogoutActions onLogout={onLogout} />);

		await user.click(screen.getByRole("button", { name: /đăng xuất tất cả thiết bị/i }));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/bạn sẽ phải đăng nhập lại trên tất cả thiết bị/i)).toBeInTheDocument();
		expect(onLogout).not.toHaveBeenCalled();
	});

	it("confirms logout from all devices", async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn().mockResolvedValue(undefined);

		render(<LogoutActions onLogout={onLogout} />);

		await user.click(screen.getByRole("button", { name: /đăng xuất tất cả thiết bị/i }));
		await user.click(screen.getByRole("button", { name: /xác nhận/i }));

		await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(1));
		expect(onLogout).toHaveBeenCalledWith(true);
	});

	it("does not call logout when all-device confirmation is cancelled", async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn().mockResolvedValue(undefined);

		render(<LogoutActions onLogout={onLogout} />);

		await user.click(screen.getByRole("button", { name: /đăng xuất tất cả thiết bị/i }));
		await user.click(screen.getByRole("button", { name: /hủy/i }));

		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		expect(onLogout).not.toHaveBeenCalled();
	});

	it("prevents repeated submissions while logout is pending", async () => {
		const user = userEvent.setup();

		let resolveLogout!: () => void;
		const pendingLogout = new Promise<void>((resolve) => {
			resolveLogout = resolve;
		});
		const onLogout = vi.fn().mockReturnValue(pendingLogout);

		render(<LogoutActions onLogout={onLogout} />);

		const button = screen.getByRole("button", {
			name: /đăng xuất thiết bị này/i,
		});

		await user.click(button);

		expect(button).toBeDisabled();
		expect(onLogout).toHaveBeenCalledTimes(1);

		await user.click(button);
		expect(onLogout).toHaveBeenCalledTimes(1);

		resolveLogout();
		await waitFor(() => expect(button).not.toBeDisabled());
	});

	it("shows a safe error message when logout fails", async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn().mockRejectedValue(new Error("network failure"));

		render(<LogoutActions onLogout={onLogout} />);

		await user.click(screen.getByRole("button", { name: /đăng xuất thiết bị này/i }));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent(/không thể đăng xuất/i);
		expect(alert).toHaveTextContent(/vui lòng thử lại/i);
	});

	it("allows retry after a failed logout", async () => {
		const user = userEvent.setup();
		const onLogout = vi
			.fn()
			.mockRejectedValueOnce(new Error("network failure"))
			.mockResolvedValueOnce(undefined);

		render(<LogoutActions onLogout={onLogout} />);

		const button = screen.getByRole("button", {
			name: /đăng xuất thiết bị này/i,
		});

		await user.click(button);
		expect(await screen.findByRole("alert")).toBeInTheDocument();

		await user.click(button);
		await waitFor(() => expect(onLogout).toHaveBeenCalledTimes(2));
	});
});
