import { zodResolver } from "@hookform/resolvers/zod";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { type PorterProfileFormValues, porterProfileSchema } from "../schema/porter-profile.schema";
import { PorterProfileForm } from "./PorterProfileForm";
import { PorterProfileHeader } from "./PorterProfileHeader";

function FormWrapper({
	defaultValues = {
		experienceYears: 2,
		certifications: ["WFA"],
		languages: ["Vietnamese"],
		availabilityStatus: "available" as const,
	},
	isSaving = false,
	onSave = vi.fn(),
	onReset = vi.fn(),
	isDirty = false,
}: {
	defaultValues?: PorterProfileFormValues;
	isSaving?: boolean;
	onSave?: (values: PorterProfileFormValues) => void;
	onReset?: () => void;
	isDirty?: boolean;
}) {
	const form = useForm<PorterProfileFormValues>({
		resolver: zodResolver(porterProfileSchema),
		defaultValues,
	});

	return (
		<PorterProfileForm
			form={form}
			isSaving={isSaving}
			onSubmit={form.handleSubmit(onSave)}
			onReset={onReset}
			isDirty={isDirty}
		/>
	);
}

describe("PorterProfileForm & PorterProfileHeader", () => {
	it("renders header with read-only ratingAvg and completedTrips and no compensation fields", () => {
		render(
			<PorterProfileHeader
				profile={{
					porterId: "p-1",
					experienceYears: 5,
					certifications: ["WFA"],
					languages: ["Vietnamese"],
					availabilityStatus: "available",
					ratingAvg: 4.8,
					completedTrips: 18,
					version: 2,
					createdAt: "2026-01-01",
					updatedAt: "2026-01-02",
				}}
			/>
		);

		expect(screen.getByTestId("readonly-rating-card")).toHaveTextContent("4.8");
		expect(screen.getByTestId("readonly-completed-trips-card")).toHaveTextContent("18");
		expect(screen.getByTestId("profile-persistence-badge")).toHaveTextContent("Phiên bản v2");

		// Assert NO compensation fields
		expect(screen.queryByText(/dayRate/i)).toBeNull();
		expect(screen.queryByText(/day_rate/i)).toBeNull();
		expect(screen.queryByText(/salary/i)).toBeNull();
		expect(screen.queryByText(/wage/i)).toBeNull();
		expect(screen.queryByText(/thù lao/i)).toBeNull();
		expect(screen.queryByText(/lương/i)).toBeNull();
	});

	it("renders form fields and permits experience = 0", async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();

		render(
			<FormWrapper
				defaultValues={{
					experienceYears: 0,
					certifications: [],
					languages: [],
					availabilityStatus: "available",
				}}
				onSave={onSave}
			/>
		);

		const expInput = screen.getByLabelText(/Số năm kinh nghiệm Porter/i);
		expect(expInput).toHaveValue(0);

		await user.click(screen.getByTestId("save-porter-profile-button"));

		await waitFor(() => {
			expect(onSave).toHaveBeenCalledWith(
				expect.objectContaining({
					experienceYears: 0,
					availabilityStatus: "available",
				}),
				expect.anything()
			);
		});
	});

	it("rejects negative experience input and shows validation error", async () => {
		const onSave = vi.fn();

		render(<FormWrapper onSave={onSave} />);

		const expInput = screen.getByLabelText(/Số năm kinh nghiệm Porter/i);
		fireEvent.change(expInput, { target: { value: "-5" } });
		fireEvent.submit(screen.getByTestId("porter-profile-form"));

		await waitFor(() => {
			expect(screen.getByTestId("experienceYears-error")).toBeVisible();
		});
		expect(onSave).not.toHaveBeenCalled();
	});

	it("adds certifications and prevents case-insensitive duplicates", async () => {
		const user = userEvent.setup();
		render(<FormWrapper />);

		const certInput = screen.getByPlaceholderText(/VD: Sơ cấp cứu WFA/i);
		await user.type(certInput, "wfa"); // duplicate of existing "WFA"
		await user.keyboard("{Enter}");

		expect(screen.getByText("Mục này đã tồn tại trong danh sách")).toBeVisible();
	});

	it("disables save button and shows pending spinner when isSaving is true", () => {
		render(<FormWrapper isSaving={true} />);

		const saveButton = screen.getByTestId("save-porter-profile-button");
		expect(saveButton).toBeDisabled();
		expect(screen.getByText("Đang lưu hồ sơ...")).toBeVisible();
	});
});
