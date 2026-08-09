import { zodResolver } from "@hookform/resolvers/zod";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { type CamperProfileFormValues, camperProfileSchema } from "../schema/profile.schema";
import { EmergencyContactsForm } from "./EmergencyContactsForm";

function TestEmergencyForm({
	onSubmit = vi.fn(),
}: { onSubmit?: (values: CamperProfileFormValues) => void }) {
	const form = useForm<CamperProfileFormValues>({
		resolver: zodResolver(camperProfileSchema),
		defaultValues: {
			fullName: "Nguyen Van B",
			dateOfBirth: "1995-04-12",
			gender: "male",
			address: "Da Lat, Lam Dong",
			bio: "",
			campingExperienceYears: 0,
			trekkingExperienceDetails: "",
			emergencyContacts: [],
		},
	});

	return (
		<form onSubmit={form.handleSubmit(onSubmit)}>
			<EmergencyContactsForm form={form} isSaving={false} />
			<button type="submit">Save</button>
		</form>
	);
}

describe("EmergencyContactsForm", () => {
	it("renders an empty state and lets the user add up to two contacts", async () => {
		const user = userEvent.setup();
		render(<TestEmergencyForm />);

		expect(screen.getByText(/Chưa có liên hệ khẩn cấp/i)).toBeInTheDocument();

		const addButton = screen.getByRole("button", { name: /Thêm liên hệ/i });
		await user.click(addButton);
		await user.click(addButton);

		expect(screen.getByText("Liên hệ #1")).toBeInTheDocument();
		expect(screen.getByText("Liên hệ #2")).toBeInTheDocument();
		expect(addButton).toBeDisabled();
	});

	it("validates editable emergency contact fields before submit", async () => {
		const user = userEvent.setup();
		const onSubmit = vi.fn();
		render(<TestEmergencyForm onSubmit={onSubmit} />);

		await user.click(screen.getByRole("button", { name: /Thêm liên hệ/i }));
		await user.type(screen.getByLabelText(/Họ tên/i), "A");
		await user.type(screen.getByLabelText(/Mối quan hệ/i), "B");
		await user.type(screen.getByLabelText(/Số điện thoại/i), "123");
		await user.click(screen.getByRole("button", { name: "Save" }));

		expect(
			await screen.findByText("Tên liên hệ khẩn cấp phải có ít nhất 2 ký tự")
		).toBeInTheDocument();
		expect(screen.getByText("Mối quan hệ phải có ít nhất 2 ký tự")).toBeInTheDocument();
		expect(screen.getByText("Số điện thoại khẩn cấp không hợp lệ")).toBeInTheDocument();
		expect(onSubmit).not.toHaveBeenCalled();
	});
});
