import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useQuickCreatePrefill } from "../hooks/useQuickCreatePrefill";
import {
	QUICK_CREATE_PREFILL_TTL_MS,
	consumeQuickCreatePrefill,
	saveQuickCreatePrefill,
} from "./quick-create-prefill";

describe("quick-create-prefill & useQuickCreatePrefill", () => {
	const samplePrefill = {
		routeId: "11111111-1111-4111-8111-111111111111",
		title: "Leo núi Sơn Trà (Tháng 1/2027)",
		areaCode: "DNG-SON-TRA",
		tripType: "day_trip" as const,
		pricePerPerson: 650000,
		capacityMin: 6,
		capacityMax: 12,
		meetingLongitude: 108.25,
		meetingLatitude: 16.1,
		startsAt: null,
		endsAt: null,
		meetingAt: null,
		bookingDeadline: null,
		suggestedMonth: "2027-01",
	};

	beforeEach(() => {
		window.sessionStorage.clear();
		window.history.replaceState({}, "", "/host/trips/create?from=host-analytics");
	});

	it("stores per hostId, consumes once, and rejects expired or different hostId", () => {
		const now = 1_700_000_000_000;
		saveQuickCreatePrefill("host-a", "sug-1", samplePrefill, now);

		// Different hostId cannot read host-a's prefill
		expect(consumeQuickCreatePrefill("host-b", now + 1000)).toBeNull();

		// Expired entry (> 10 minutes) is rejected
		saveQuickCreatePrefill("host-a", "sug-2", samplePrefill, now);
		expect(consumeQuickCreatePrefill("host-a", now + QUICK_CREATE_PREFILL_TTL_MS + 1)).toBeNull();

		// Valid consume-once: second call (e.g. reload) returns null
		saveQuickCreatePrefill("host-a", "sug-3", samplePrefill, now);
		const first = consumeQuickCreatePrefill("host-a", now + 5_000);
		expect(first?.suggestionId).toBe("sug-3");
		expect(first?.prefill.pricePerPerson).toBe(650000);
		expect(consumeQuickCreatePrefill("host-a", now + 6_000)).toBeNull();
	});

	it("waits for async draft restoration race before deciding and prompts confirmation when draft arrives", () => {
		saveQuickCreatePrefill("host-a", "sug-1", samplePrefill);

		// Initially draft is still loading (draftSettled = false, hasExistingDraft = false)
		const { result, rerender } = renderHook(
			(props: { draftSettled: boolean; hasExistingDraft: boolean; isEditMode: boolean }) =>
				useQuickCreatePrefill({
					owner: "host-a",
					...props,
				}),
			{
				initialProps: {
					draftSettled: false,
					hasExistingDraft: false,
					isEditMode: false,
				},
			}
		);

		// Must NOT auto-apply before draft settles
		expect(result.current.appliedValues).toBeUndefined();
		expect(result.current.needsConfirm).toBe(false);

		// Async draft finishes loading and turns out a draft exists -> must ask confirmation
		rerender({ draftSettled: true, hasExistingDraft: true, isEditMode: false });
		expect(result.current.needsConfirm).toBe(true);
		expect(result.current.appliedValues).toBeUndefined();

		// User confirms replacing old draft -> prefill applied with empty specific dates
		act(() => {
			result.current.confirmReplaceDraft();
		});
		expect(result.current.needsConfirm).toBe(false);
		expect(result.current.appliedValues?.routeId).toBe(samplePrefill.routeId);
		expect(result.current.appliedValues?.pricePerPerson).toBe("650000");
		expect(result.current.appliedValues?.capacityMin).toBe("6");
		expect(result.current.appliedValues?.startsAt).toBe("");
		expect(result.current.suggestedMonth).toBe("2027-01");
	});

	it("never activates in edit mode even when sessionStorage has a prefill", () => {
		saveQuickCreatePrefill("host-a", "sug-1", samplePrefill);
		const { result } = renderHook(() =>
			useQuickCreatePrefill({
				owner: "host-a",
				isEditMode: true,
				draftSettled: true,
				hasExistingDraft: false,
			})
		);
		expect(result.current.appliedValues).toBeUndefined();
		expect(result.current.needsConfirm).toBe(false);
	});
});
