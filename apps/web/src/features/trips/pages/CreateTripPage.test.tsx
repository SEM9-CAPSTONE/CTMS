import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
} from "../schema/create-trip.schema";
import type { Trip } from "../types";
import type { DraftSnapshot } from "../utils/trip-draft-cache";
import { CreateTripPage } from "./CreateTripPage";
const state = vi.hoisted(() => ({
	creation: {
		isSubmitting: false,
		error: null,
		createdTrip: null,
		pendingTrip: null,
		submit: vi.fn(),
		retry: vi.fn(),
	},
	autosave: {
		saving: false,
		saved: false,
		error: "",
		schedule: vi.fn(),
		flush: vi.fn(),
		pause: vi.fn(),
		resume: vi.fn(),
		finish: vi.fn(),
		leave: vi.fn(),
	},
	session: {
		id: "draft-id",
		ready: true,
		restored: null as DraftSnapshot | null,
		remoteId: undefined as string | undefined,
		restoreError: false,
	},
	formDraft: {
		draft: undefined,
		images: undefined,
		isLoading: false,
		error: null,
		invalidate: vi.fn(),
		retry: vi.fn(),
	},
	detailTrip: null as Trip | null,
	finalize: vi.fn(),
	complete: vi.fn(),
	update: vi.fn(),
	resetUpdate: vi.fn(),
	retryDetail: vi.fn(),
}));
vi.mock("../hooks/useCreateTrip", () => ({ useCreateTrip: () => state.creation }));
vi.mock("../hooks/useUpdateTripDraft", () => ({
	useUpdateTripDraft: () => ({
		isSubmitting: false,
		error: null,
		updatedTrip: null,
		submit: state.update,
		reset: state.resetUpdate,
		retry: vi.fn(),
	}),
}));
vi.mock("../hooks/useTripDraftSession", () => ({ useTripDraftSession: () => state.session }));
vi.mock("../hooks/useTripFormAutosave", () => ({ useTripFormAutosave: () => state.autosave }));
vi.mock("../hooks/useTripFormDraft", () => ({ useTripFormDraft: () => state.formDraft }));
vi.mock("../hooks/useTripDraftNavigation", () => ({ useTripDraftNavigation: vi.fn() }));
vi.mock("../hooks/useTripDetail", () => ({
	useTripDetail: () => ({
		trip: state.detailTrip,
		isLoading: false,
		error: null,
		retry: state.retryDetail,
	}),
}));
vi.mock("../services/trip-form-drafts.service", () => ({
	tripFormDraftsService: { complete: state.complete },
}));
vi.mock("../services/trips.service", () => ({
	tripsService: { finalizePendingUpdate: state.finalize },
}));
vi.mock("../components/PendingTripImageEditor", () => ({
	PendingTripImageEditor: ({
		onChange,
	}: { onChange: (value: { retained: []; files: [] }) => void }) => (
		<button type="button" onClick={() => onChange({ retained: [], files: [] })}>
			load-images
		</button>
	),
}));
vi.mock("../../trekking-routes/hooks/useTrekkingRoutes", () => ({
	useTrekkingRoutes: () => ({
		items: [
			{ id: "active", status: "active" },
			{ id: "draft", status: "draft" },
		],
		isLoading: false,
		error: "",
		retry: vi.fn(),
	}),
}));
vi.mock("../components/TripImageEditor", () => ({
	TripImageEditor: () => <div data-testid="image-editor" />,
}));
vi.mock("../components/ConfigureTripWaypointsPanel", () => ({
	ConfigureTripWaypointsPanel: ({
		onFinalizeUpdate,
	}: { onFinalizeUpdate?: (items: []) => Promise<unknown> }) => (
		<div data-testid="waypoints">
			{onFinalizeUpdate && (
				<button type="button" onClick={() => void onFinalizeUpdate([])}>
					finish-update
				</button>
			)}
		</div>
	),
}));
vi.mock("../components/CreateTripForm", () => ({
	CreateTripForm: ({
		defaultValues,
		initialImages = [],
		onSubmit,
		onDraftChange,
		isSubmitting,
		activeRoutes,
		submitLabel,
		imageEditor,
	}: {
		defaultValues?: CreateTripFormValues;
		initialImages?: File[];
		onSubmit: (payload: never, images?: File[]) => Promise<unknown>;
		onDraftChange: (values: CreateTripFormValues, images: File[]) => void;
		isSubmitting: boolean;
		activeRoutes: { id: string }[];
		submitLabel?: string;
		imageEditor?: ReactNode;
	}) => (
		<div data-testid="form" data-disabled={isSubmitting} data-submit-label={submitLabel}>
			{imageEditor}
			<input aria-label="mock-title" value={defaultValues?.title ?? ""} readOnly />
			<span>{initialImages.length} selected</span>
			<span>{activeRoutes.map((route) => route.id).join(",")}</span>
			<button
				type="button"
				onClick={() =>
					onDraftChange({ ...CREATE_TRIP_DEFAULT_VALUES, title: "Typing" }, initialImages)
				}
			>
				change
			</button>
			<button
				type="button"
				onClick={() =>
					void onSubmit(
						{
							title: "Submit",
							routeId: "active",
							tripType: "day_trip",
							startsAt: "2099-10-27T08:00:00.000Z",
							endsAt: "2099-10-27T18:00:00.000Z",
							meetingPoint: { type: "Point", coordinates: [108.2, 16.1] },
							meetingAt: "2099-10-27T07:30:00.000Z",
							bookingDeadline: "2099-10-26T18:00:00.000Z",
							capacityMin: 2,
							capacityMax: 10,
							pricePerPerson: 0,
							waypoints: [],
						} as never,
						initialImages
					)
				}
			>
				next
			</button>
		</div>
	),
}));
beforeEach(() => {
	vi.clearAllMocks();
	state.detailTrip = null;
	state.session.restored = null;
	state.session.ready = true;
	state.session.remoteId = undefined;
	state.autosave.saving = false;
	state.autosave.error = "";
	state.autosave.flush.mockResolvedValue(true);
	state.autosave.leave.mockResolvedValue(true);
	state.autosave.finish.mockResolvedValue(undefined);
	state.complete.mockResolvedValue({});
	state.creation.submit.mockResolvedValue(null);
});
describe("CreateTripPage automatic drafts", () => {
	it("starts a fresh form when there is no recovered session", () => {
		render(<CreateTripPage />);
		expect(screen.getByLabelText("mock-title")).toHaveValue("");
		expect(screen.getByTestId("form")).toHaveTextContent("active");
		expect(screen.queryByRole("button", { name: "Lưu nháp" })).not.toBeInTheDocument();
	});
	it("restores values and image order from the active draft session", () => {
		state.session.restored = {
			values: { ...CREATE_TRIP_DEFAULT_VALUES, title: "Restored" },
			images: [new File(["png"], "first.png", { type: "image/png" })],
		};
		render(<CreateTripPage />);
		expect(screen.getByLabelText("mock-title")).toHaveValue("Restored");
		expect(screen.getByText("1 selected")).toBeVisible();
	});
	it("schedules automatic persistence on input without locking the form", () => {
		state.autosave.saving = true;
		render(<CreateTripPage />);
		fireEvent.click(screen.getByRole("button", { name: "change" }));
		expect(state.autosave.schedule).toHaveBeenCalledWith(
			expect.objectContaining({ values: expect.objectContaining({ title: "Typing" }) })
		);
		expect(screen.getByTestId("form")).toHaveAttribute("data-disabled", "false");
	});
	it("flushes the draft and ends its session before going back", async () => {
		const back = vi.fn();
		render(<CreateTripPage onBackHome={back} />);
		fireEvent.click(screen.getByRole("button", { name: "Quay về trang quản lý Host" }));
		await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
		expect(state.autosave.leave).toHaveBeenCalledTimes(1);
	});
	it("stays in the form if neither the server nor a local backup can save", async () => {
		state.autosave.leave.mockResolvedValue(false);
		const back = vi.fn();
		render(<CreateTripPage onBackHome={back} />);
		fireEvent.click(screen.getByRole("button", { name: "Quay về trang quản lý Host" }));
		await waitFor(() => expect(state.autosave.leave).toHaveBeenCalled());
		expect(back).not.toHaveBeenCalled();
	});
	it("retires the autosaved source only after successful Trip creation", async () => {
		state.creation.submit.mockResolvedValue({ id: "trip", title: "Saved" });
		render(<CreateTripPage />);
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		await screen.findByTestId("waypoints");
		expect(state.autosave.flush).toHaveBeenCalledWith(true);
		expect(state.complete).toHaveBeenCalledWith("draft-id", "trip");
		expect(state.autosave.finish).toHaveBeenCalledTimes(1);
	});
	it("opens step one for the existing Trip without creating a second Trip", async () => {
		state.creation.submit.mockResolvedValue({ id: "existing-trip", title: "Saved" });
		const edit = vi.fn();
		render(<CreateTripPage onEditTripInfo={edit} />);
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		await screen.findByTestId("waypoints");
		fireEvent.click(screen.getByRole("button", { name: "Quay lại bước 1" }));
		expect(edit).toHaveBeenCalledWith("existing-trip");
		expect(state.resetUpdate).toHaveBeenCalledTimes(1);
		expect(screen.queryByTestId("waypoints")).not.toBeInTheDocument();
		expect(screen.getByTestId("form")).toBeVisible();
		expect(state.creation.submit).toHaveBeenCalledTimes(1);
	});
	it("does not create a Trip if its draft has not reached the server", async () => {
		state.autosave.flush.mockResolvedValue(false);
		render(<CreateTripPage />);
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		await waitFor(() => expect(state.autosave.flush).toHaveBeenCalledWith(true));
		expect(state.creation.submit).not.toHaveBeenCalled();
	});
});

it("stages step one and only sends the update after finishing step two", async () => {
	const pending: Trip = {
		id: "pending-trip",
		hostId: "host",
		routeId: "active",
		title: "Pending",
		description: null,
		coverImageUrl: null,
		itinerary: null,
		includes: null,
		excludes: null,
		tripType: "day_trip",
		durationNights: 0,
		startsAt: "2099-10-27T08:00:00.000Z",
		endsAt: "2099-10-27T18:00:00.000Z",
		meetingPoint: { type: "Point", coordinates: [108.2, 16.1] },
		meetingAt: "2099-10-27T07:30:00.000Z",
		bookingDeadline: "2099-10-26T18:00:00.000Z",
		capacityMin: 2,
		capacityMax: 10,
		seatsTaken: 0,
		pricePerPerson: 0,
		cancellationPolicy: null,
		status: "pending_approval",
		createdAt: "2099-10-01T00:00:00.000Z",
		updatedAt: "2099-10-01T00:00:00.000Z",
		waypoints: [],
	};
	state.detailTrip = pending;
	state.update.mockResolvedValue({ ...pending, title: "Updated pending" });
	render(<CreateTripPage editTripId={pending.id} />);
	expect(screen.getByTestId("form")).toHaveAttribute("data-submit-label", "Bước tiếp theo");
	fireEvent.click(screen.getByRole("button", { name: "load-images" }));
	fireEvent.click(screen.getByRole("button", { name: "next" }));
	await screen.findByTestId("waypoints");
	expect(state.update).not.toHaveBeenCalled();
	expect(state.finalize).not.toHaveBeenCalled();
	expect(state.creation.submit).not.toHaveBeenCalled();
	expect(state.complete).not.toHaveBeenCalled();
	expect(screen.getByTestId("waypoints")).toBeVisible();
	state.finalize.mockResolvedValue({ ...pending, title: "Submit", images: [] });
	fireEvent.click(screen.getByRole("button", { name: "finish-update" }));
	await waitFor(() => expect(state.finalize).toHaveBeenCalledTimes(1));
	expect(state.finalize).toHaveBeenCalledWith(
		pending.id,
		expect.objectContaining({
			title: "Submit",
			expectedUpdatedAt: pending.updatedAt,
			waypoints: [],
			retainedImageIds: [],
		}),
		[]
	);
});
