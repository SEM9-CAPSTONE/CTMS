import { beforeEach, describe, expect, it } from "vitest";
import { CREATE_TRIP_DEFAULT_VALUES } from "../schema/create-trip.schema";
import {
	type CachedTripDraft,
	activateDraft,
	activeDraftId,
	endDraftSession,
	hasDraftContent,
	listDraftCaches,
	markDraftSynced,
	readDraftCache,
	restoreCachedDraft,
	writeDraftCache,
} from "./trip-draft-cache";
const meta = (): CachedTripDraft => ({
	id: "one",
	owner: "host",
	values: { ...CREATE_TRIP_DEFAULT_VALUES, title: "Draft" },
	revision: "r1",
	imageVersion: "v1",
	imageCount: 0,
	updatedAt: "2026-10-26",
	dirty: true,
	serverSaved: false,
});
beforeEach(() => {
	localStorage.clear();
	sessionStorage.clear();
	window.history.replaceState(null, "", "/host/trips/create");
});
describe("draft reload recovery", () => {
	it("restores the active editor across reload but starts fresh on a new navigation entry", () => {
		activateDraft("host", "one");
		expect(activeDraftId("host")).toBe("one");
		window.history.pushState(null, "", "/dashboard");
		window.history.pushState(null, "", "/host/trips/create");
		expect(activeDraftId("host")).toBeUndefined();
	});
	it("ends the editor session when leaving", () => {
		activateDraft("host", "one");
		endDraftSession("host", "one");
		expect(activeDraftId("host")).toBeUndefined();
	});
	it("keeps each Host's drafts separate", () => {
		writeDraftCache(meta());
		expect(listDraftCaches("other")).toEqual([]);
		expect(readDraftCache("other", "one")).toBeNull();
		expect(listDraftCaches("host")).toHaveLength(1);
	});
	it("does not mark newer local changes clean when an older save succeeds", () => {
		const old = meta();
		writeDraftCache({ ...old, revision: "r2" });
		markDraftSynced(old);
		expect(readDraftCache("host", "one")).toMatchObject({
			dirty: true,
			serverSaved: true,
			revision: "r2",
		});
	});
	it("restores text-only drafts without requiring image storage", async () => {
		const draft = meta();
		writeDraftCache(draft);
		expect(await restoreCachedDraft(draft)).toEqual({
			values: draft.values,
			images: [],
			tripId: undefined,
		});
	});
	it("ignores untouched defaults but retains route-only or photo-only drafts", () => {
		const values = { ...CREATE_TRIP_DEFAULT_VALUES };
		expect(hasDraftContent({ values, images: [] })).toBe(false);
		expect(hasDraftContent({ values: { ...values, routeId: "route" }, images: [] })).toBe(true);
		expect(hasDraftContent({ values, images: [new File(["png"], "one.png")] })).toBe(true);
	});
});
