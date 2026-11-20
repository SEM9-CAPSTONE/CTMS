import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
} from "../schema/create-trip.schema";
import {
	type StoredQuickCreatePrefill,
	consumeQuickCreatePrefill,
} from "../utils/quick-create-prefill";

export interface UseQuickCreatePrefillOptions {
	owner: string;
	isEditMode: boolean;
	draftSettled: boolean;
	hasExistingDraft: boolean;
}

export interface UseQuickCreatePrefillResult {
	appliedValues: CreateTripFormValues | undefined;
	suggestedMonth: string | null;
	needsConfirm: boolean;
	isPrefillActive: boolean;
	confirmReplaceDraft: () => void;
	keepExistingDraft: () => void;
}

function buildPrefillFormValues(stored: StoredQuickCreatePrefill): CreateTripFormValues {
	const { prefill } = stored;
	return {
		...CREATE_TRIP_DEFAULT_VALUES,
		routeId: prefill.routeId,
		areaCode: prefill.areaCode ?? "",
		tripType: prefill.tripType,
		pricePerPerson: prefill.pricePerPerson !== null ? String(prefill.pricePerPerson) : "0",
		capacityMin: prefill.capacityMin !== null ? String(prefill.capacityMin) : "",
		// Explicitly leave specific dates empty for Host to choose
		startsAt: "",
		endsAt: "",
		meetingAt: "",
		bookingDeadline: "",
	};
}

function isFromHostAnalyticsUrl(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("from") === "host-analytics";
}

/**
 * Consumes a one-time quick-create prefill from sessionStorage.
 * - Never activates in edit mode.
 * - Waits until async draft restoration settles before deciding whether to ask confirmation.
 * - Cleans up ?from=host-analytics from URL so page reload never reapplies.
 */
export function useQuickCreatePrefill({
	owner,
	isEditMode,
	draftSettled,
	hasExistingDraft,
}: UseQuickCreatePrefillOptions): UseQuickCreatePrefillResult {
	const consumedRef = useRef(false);
	const [pending, setPending] = useState<StoredQuickCreatePrefill | null>(null);
	const [decision, setDecision] = useState<"pending" | "applied" | "dismissed">("pending");

	useEffect(() => {
		if (consumedRef.current || isEditMode || !owner) return;
		if (!isFromHostAnalyticsUrl()) return;
		consumedRef.current = true;

		const stored = consumeQuickCreatePrefill(owner);
		if (typeof window !== "undefined") {
			const url = new URL(window.location.href);
			url.searchParams.delete("from");
			window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
		}
		if (stored) {
			setPending(stored);
		}
	}, [owner, isEditMode]);

	// Once async draft restoration finishes, auto-apply if no draft exists; else require confirmation.
	useEffect(() => {
		if (!pending || decision !== "pending" || !draftSettled) return;
		if (!hasExistingDraft) {
			setDecision("applied");
		}
	}, [pending, decision, draftSettled, hasExistingDraft]);

	const confirmReplaceDraft = useCallback(() => {
		setDecision("applied");
	}, []);

	const keepExistingDraft = useCallback(() => {
		setDecision("dismissed");
	}, []);

	const appliedValues = useMemo(() => {
		if (isEditMode || !pending || decision !== "applied") return undefined;
		return buildPrefillFormValues(pending);
	}, [isEditMode, pending, decision]);

	const needsConfirm = Boolean(
		!isEditMode && pending && decision === "pending" && draftSettled && hasExistingDraft
	);

	return {
		appliedValues,
		suggestedMonth: decision === "applied" && pending ? pending.prefill.suggestedMonth : null,
		needsConfirm,
		isPrefillActive: Boolean(appliedValues),
		confirmReplaceDraft,
		keepExistingDraft,
	};
}
