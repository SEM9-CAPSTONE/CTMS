import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CREATE_TRIP_DEFAULT_VALUES } from "../schema/create-trip.schema";
import { useTripDraftSession } from "./useTripDraftSession";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
	vi.unstubAllGlobals();
	localStorage.clear();
	sessionStorage.clear();
});

it("creates, saves, and restores a draft when randomUUID is unavailable on HTTP", async () => {
	vi.stubGlobal("crypto", { getRandomValues: crypto.getRandomValues.bind(crypto) });
	window.history.replaceState(null, "", "/host/trips/create");
	const { result, unmount } = renderHook(() => useTripDraftSession());
	const draftId = result.current.id;
	expect(draftId).toMatch(UUID_V4);

	const snapshot = {
		values: { ...CREATE_TRIP_DEFAULT_VALUES, title: "Khám phá bán đảo Sơn Trà" },
		images: [],
	};
	const saved = result.current.remember(snapshot);
	expect(saved).toMatchObject({
		id: draftId,
		revision: expect.stringMatching(UUID_V4),
		imageVersion: expect.stringMatching(UUID_V4),
	});
	expect(await result.current.durable(saved ?? undefined)).toBe(true);
	unmount();

	const reopened = renderHook(() => useTripDraftSession());
	await waitFor(() => expect(reopened.result.current.restored?.values).toEqual(snapshot.values));
	expect(reopened.result.current.id).toBe(draftId);
});
