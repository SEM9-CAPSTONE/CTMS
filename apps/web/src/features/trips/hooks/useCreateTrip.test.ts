import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../../core/api";
import { tripsService } from "../services/trips.service";
import type { CreateTripInput } from "../types";
import { mapCreateTripError, useCreateTrip } from "./useCreateTrip";

vi.mock("../services/trips.service", () => ({
	tripsService: {
		create: vi.fn(),
		updateDraft: vi.fn(),
		addImage: vi.fn(),
		configureWaypoints: vi.fn(),
		search: vi.fn(),
		getById: vi.fn(),
	},
}));

const payload: CreateTripInput = {
	routeId: "11111111-1111-4111-8111-111111111111",
	title: "Bidoup draft",
	tripType: "day_trip",
	startsAt: "2026-10-01T02:00:00.000Z",
	endsAt: "2026-10-01T10:00:00.000Z",
	meetingPoint: { type: "Point", coordinates: [108.22, 16.04] },
	bookingDeadline: "2026-09-30T02:00:00.000Z",
	capacityMin: 2,
	capacityMax: 12,
	pricePerPerson: 0,
	waypoints: [
		{
			type: "start",
			name: "Trailhead",
			location: { type: "Point", coordinates: [108.22, 16.04] },
			plannedAt: "2026-10-01T02:00:00.000Z",
		},
		{
			type: "finish",
			name: "Exit",
			location: { type: "Point", coordinates: [108.25, 16.06] },
			plannedAt: "2026-10-01T10:00:00.000Z",
		},
	],
};

describe("useCreateTrip", () => {
	beforeEach(() => vi.clearAllMocks());

	it("prevents duplicate submissions while a request is running", async () => {
		let resolve!: (value: never) => void;
		vi.mocked(tripsService.create).mockImplementation(
			() =>
				new Promise((done) => {
					resolve = done;
				})
		);

		const { result } = renderHook(() => useCreateTrip());
		let first!: Promise<unknown>;

		await act(async () => {
			first = result.current.submit(payload);
			const second = await result.current.submit(payload);
			expect(second).toBeNull();
			resolve({ id: "trip" } as never);
			await first;
		});

		expect(tripsService.create).toHaveBeenCalledTimes(1);
	});

	it.each([401, 403, 404, 409, 422])("maps API status %s", (status) => {
		expect(mapCreateTripError(new HttpError("failure", status, {}))).toEqual(
			expect.objectContaining({ status })
		);
	});

	it("maps backend 422 field errors for the form", () => {
		const error = mapCreateTripError(
			new HttpError("invalid", 422, {
				message: [
					{ field: "bookingDeadline", errors: ["bookingDeadline must be before startsAt"] },
				],
			})
		);

		expect(error.fieldErrors).toEqual({
			bookingDeadline: "bookingDeadline must be before startsAt",
		});
	});

	it("keeps the last payload available for retry after a recoverable failure", async () => {
		vi.mocked(tripsService.create)
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce({ id: "trip" } as never);

		const { result } = renderHook(() => useCreateTrip());

		await act(async () => {
			await result.current.submit(payload);
		});
		expect(result.current.error).not.toBeNull();

		await act(async () => {
			await result.current.retry();
		});

		expect(tripsService.create).toHaveBeenNthCalledWith(2, payload);
	});
	it("uploads selected images in order before completing creation", async () => {
		const first = new File(["first"], "first.png", { type: "image/png" });
		const second = new File(["second"], "second.png", { type: "image/png" });
		vi.mocked(tripsService.create).mockResolvedValueOnce({
			id: "trip",
			coverImageUrl: null,
		} as never);
		vi.mocked(tripsService.addImage)
			.mockResolvedValueOnce([{ id: "first", url: "first-url", sortOrder: 0 }])
			.mockResolvedValueOnce([
				{ id: "first", url: "first-url", sortOrder: 0 },
				{ id: "second", url: "second-url", sortOrder: 1 },
			]);
		const { result } = renderHook(() => useCreateTrip());
		await act(async () => {
			await result.current.submit(payload, [first, second]);
		});
		expect(tripsService.create).toHaveBeenCalledTimes(1);
		expect(tripsService.addImage).toHaveBeenNthCalledWith(1, "trip", first);
		expect(tripsService.addImage).toHaveBeenNthCalledWith(2, "trip", second);
		expect(result.current.createdTrip).toMatchObject({ id: "trip", coverImageUrl: "first-url" });
		expect(result.current.pendingTrip).toBeNull();
	});
	it("retains the created draft and retries only the failed upload", async () => {
		const first = new File(["first"], "first.png", { type: "image/png" });
		const second = new File(["second"], "second.png", { type: "image/png" });
		vi.mocked(tripsService.create).mockResolvedValueOnce({
			id: "trip",
			coverImageUrl: null,
		} as never);
		vi.mocked(tripsService.addImage)
			.mockResolvedValueOnce([{ id: "first", url: "first-url", sortOrder: 0 }])
			.mockRejectedValueOnce(new Error("offline"))
			.mockResolvedValueOnce([
				{ id: "first", url: "first-url", sortOrder: 0 },
				{ id: "second", url: "second-url", sortOrder: 1 },
			]);
		const { result } = renderHook(() => useCreateTrip());
		await act(async () => {
			await result.current.submit(payload, [first, second]);
		});
		expect(result.current.createdTrip).toBeNull();
		expect(result.current.pendingTrip?.id).toBe("trip");
		expect(result.current.error).toMatchObject({ canRetry: true });
		await act(async () => {
			await result.current.retry();
		});
		expect(tripsService.create).toHaveBeenCalledTimes(1);
		expect(vi.mocked(tripsService.addImage).mock.calls.map((call) => call[1])).toEqual([
			first,
			second,
			second,
		]);
		expect(result.current.createdTrip?.coverImageUrl).toBe("first-url");
	});
	it("blocks duplicate submits while an upload is in flight", async () => {
		let finish!: (images: []) => void;
		vi.mocked(tripsService.create).mockResolvedValueOnce({ id: "trip" } as never);
		vi.mocked(tripsService.addImage).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		);
		const { result } = renderHook(() => useCreateTrip());
		let submission!: Promise<unknown>;
		await act(async () => {
			submission = result.current.submit(payload, [
				new File(["x"], "x.png", { type: "image/png" }),
			]);
		});
		expect(result.current.isSubmitting).toBe(true);
		expect(result.current.createdTrip).toBeNull();
		await act(async () => {
			expect(await result.current.submit(payload)).toBeNull();
			finish([]);
			await submission;
		});
		expect(tripsService.create).toHaveBeenCalledTimes(1);
	});
	it("rejects too many files before creating a Trip", async () => {
		const { result } = renderHook(() => useCreateTrip());
		await act(async () => {
			await result.current.submit(
				payload,
				Array.from({ length: 6 }, () => new File(["x"], "x.png", { type: "image/png" }))
			);
		});
		expect(tripsService.create).not.toHaveBeenCalled();
		expect(result.current.error).toMatchObject({ canRetry: false });
	});
	it("resumes an existing saved Trip after leaving an interrupted image upload without creating another Trip", async () => {
		const existing = { id: "saved-trip", coverImageUrl: null } as never;
		vi.mocked(tripsService.updateDraft).mockResolvedValueOnce(existing);
		vi.mocked(tripsService.addImage).mockResolvedValueOnce([
			{ id: "image", url: "image-url", sortOrder: 0 },
		]);
		const { result } = renderHook(() => useCreateTrip());
		await act(async () => {
			await result.current.submit(
				payload,
				[new File(["png"], "first.png", { type: "image/png" })],
				existing
			);
		});
		expect(tripsService.create).not.toHaveBeenCalled();
		expect(tripsService.updateDraft).toHaveBeenCalledWith("saved-trip", payload);
		expect(tripsService.addImage).toHaveBeenCalledWith("saved-trip", expect.any(File));
	});
});
