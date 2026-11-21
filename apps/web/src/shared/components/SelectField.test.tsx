import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { SelectField } from "./SelectField";

it("supports keyboard selection and Escape without changing the value", async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	render(
		<SelectField
			label="Cấp đề xuất"
			value="learning"
			options={[
				{ value: "learning", label: "Học việc" },
				{ value: "expert", label: "Chuyên gia" },
			]}
			onChange={onChange}
		/>
	);
	await user.click(screen.getByRole("combobox"));
	await user.keyboard("{ArrowDown}{Enter}");
	expect(onChange).toHaveBeenCalledWith("expert");
	await user.click(screen.getByRole("combobox"));
	await user.keyboard("{ArrowDown}{Escape}");
	expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
	expect(onChange).toHaveBeenCalledTimes(1);
});
