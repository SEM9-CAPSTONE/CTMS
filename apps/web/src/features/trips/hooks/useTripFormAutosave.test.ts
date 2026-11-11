import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CREATE_TRIP_DEFAULT_VALUES } from "../schema/create-trip.schema";
import type { CachedTripDraft, DraftSnapshot } from "../utils/trip-draft-cache";
import type { TripDraftSession } from "./useTripDraftSession";
import { useTripFormAutosave } from "./useTripFormAutosave";
const api = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("../services/trip-form-drafts.service", () => ({ tripFormDraftsService: api }));
function fixture() {
	let snapshot: DraftSnapshot = {
		values: { ...CREATE_TRIP_DEFAULT_VALUES, title: "Draft" },
		images: [],
	};
	const meta: CachedTripDraft = {
		id: "draft",
		owner: "host",
		values: snapshot.values,
		revision: "one",
		imageVersion: "one",
		imageCount: 0,
		updatedAt: "",
		dirty: true,
		serverSaved: false,
	};
	const session: TripDraftSession = {
		id: "draft",
		owner: "host",
		ready: true,
		restored: null,
		restoreError: false,
		hasLocalRecovery: false,
		remoteId: undefined,
		initialServerSaved: false,
		remember: vi.fn(() => meta),
		durable: vi.fn(async () => true),
		synced: vi.fn(),
		end: vi.fn(async () => {}),
		discard: vi.fn(async () => {}),
	};
	const options = {
		session,
		enabled: true,
		busy: false,
		read: () => snapshot,
		invalidate: vi.fn(),
	};
	return {
		session,
		options,
		set: (value: DraftSnapshot) => {
			snapshot = value;
		},
		get: () => snapshot,
	};
}
beforeEach(() => {
	vi.clearAllMocks();
	api.save.mockResolvedValue({ id: "draft" });
});
describe("automatic trip draft persistence", () => {
	it("saves one stable draft and preserves unchanged images on text edits", async () => {
		const f = fixture();
		f.set({ ...f.get(), images: [new File(["png"], "first.png", { type: "image/png" })] });
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		await act(async () => {
			await result.current.flush();
		});
		expect(api.save).toHaveBeenNthCalledWith(
			1,
			"draft",
			f.get().values,
			f.get().images,
			undefined,
			false
		);
		f.set({ ...f.get(), values: { ...f.get().values, title: "Edited" } });
		await act(async () => {
			await result.current.flush();
		});
		expect(api.save).toHaveBeenNthCalledWith(2, "draft", f.get().values, [], undefined, true);
		await act(async () => {
			await result.current.flush();
		});
		expect(api.save).toHaveBeenCalledTimes(2);
	});
	it("serializes requests and saves newer edits made while a request is running", async () => {
		const f = fixture();
		let resolve: () => void = () => {};
		api.save.mockImplementationOnce(
			() =>
				new Promise<void>((done) => {
					resolve = done;
				})
		);
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		let pending = Promise.resolve(true);
		act(() => {
			pending = result.current.flush();
		});
		await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
		f.set({ ...f.get(), values: { ...f.get().values, title: "Latest" } });
		act(() => result.current.schedule(f.get()));
		await act(async () => {
			resolve();
			await pending;
		});
		expect(api.save).toHaveBeenCalledTimes(2);
		expect(api.save.mock.calls[1][1].title).toBe("Latest");
	});
	it("allows leaving with a durable local backup when the server fails", async () => {
		api.save.mockRejectedValue(new Error("Offline"));
		const f = fixture();
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		await act(async () => {
			expect(await result.current.leave()).toBe(true);
		});
		expect(f.session.end).toHaveBeenCalledTimes(1);
		expect(f.session.synced).not.toHaveBeenCalled();
	});
	it("requires server persistence before creating a Trip", async () => {
		api.save.mockRejectedValue(new Error("Offline"));
		const f = fixture();
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		await act(async () => {
			expect(await result.current.flush(true)).toBe(false);
		});
		expect(f.session.end).not.toHaveBeenCalled();
	});
	it("blocks leaving when both storage locations fail", async () => {
		api.save.mockRejectedValue(new Error("Offline"));
		const f = fixture();
		vi.mocked(f.session.durable).mockResolvedValue(false);
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		await act(async () => {
			expect(await result.current.leave()).toBe(false);
		});
		expect(f.session.end).not.toHaveBeenCalled();
		expect(result.current.error).toContain("Chưa lưu được");
	});
	it("does not save an untouched empty form", async () => {
		const f = fixture();
		f.set({ values: { ...CREATE_TRIP_DEFAULT_VALUES }, images: [] });
		const { result } = renderHook(() => useTripFormAutosave(f.options));
		await act(async () => {
			expect(await result.current.leave()).toBe(true);
		});
		expect(api.save).not.toHaveBeenCalled();
	});
	it("captures current input when the tab exits", async () => {
		const f = fixture();
		renderHook(() => useTripFormAutosave(f.options));
		act(() => {
			window.dispatchEvent(new Event("pagehide"));
		});
		await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1));
		expect(f.session.remember).toHaveBeenCalledWith(f.get());
	});
});
