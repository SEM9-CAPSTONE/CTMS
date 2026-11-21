import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuickCreateContextResponse } from "../../host-analytics/types";
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
	prefillVersion: number;
	suggestedMonth: string | null;
	needsConfirm: boolean;
	isPrefillActive: boolean;
	confirmReplaceDraft: () => void;
	keepExistingDraft: () => void;
	applyDirectPrefill: (
		suggestionId: string,
		prefill: QuickCreateContextResponse["prefill"]
	) => void;
}

function toVietnamDateTimeLocal(iso: string | null | undefined): string {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(date);
	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
	const hour = get("hour") === "24" ? "00" : get("hour");
	return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

function buildPrefillFormValues(stored: StoredQuickCreatePrefill): CreateTripFormValues {
	const { prefill } = stored;
	return {
		...CREATE_TRIP_DEFAULT_VALUES,
		routeId: prefill.routeId,
		title: prefill.title ?? "",
		areaCode: prefill.areaCode ?? "",
		tripType: prefill.tripType,
		pricePerPerson: prefill.pricePerPerson !== null ? String(prefill.pricePerPerson) : "0",
		capacityMin: prefill.capacityMin !== null ? String(prefill.capacityMin) : "",
		capacityMax: prefill.capacityMax !== null ? String(prefill.capacityMax) : "",
		meetingLongitude:
			prefill.meetingLongitude !== null && prefill.meetingLongitude !== undefined
				? String(prefill.meetingLongitude)
				: "",
		meetingLatitude:
			prefill.meetingLatitude !== null && prefill.meetingLatitude !== undefined
				? String(prefill.meetingLatitude)
				: "",
		startsAt: toVietnamDateTimeLocal(prefill.startsAt),
		endsAt: toVietnamDateTimeLocal(prefill.endsAt),
		meetingAt: toVietnamDateTimeLocal(prefill.meetingAt),
		bookingDeadline: toVietnamDateTimeLocal(prefill.bookingDeadline),
	};
}

function isFromHostAnalyticsUrl(): boolean {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("from") === "host-analytics";
}

export function useQuickCreatePrefill({
	owner,
	isEditMode,
	draftSettled,
	hasExistingDraft,
}: UseQuickCreatePrefillOptions): UseQuickCreatePrefillResult {
	const consumedRef = useRef(false);
	const [pending, setPending] = useState<StoredQuickCreatePrefill | null>(null);
	const [decision, setDecision] = useState<"pending" | "applied" | "dismissed">("pending");
	const [prefillVersion, setPrefillVersion] = useState(0);

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

	useEffect(() => {
		if (!pending || decision !== "pending" || !draftSettled) return;
		if (!hasExistingDraft) {
			setDecision("applied");
		}
	}, [pending, decision, draftSettled, hasExistingDraft]);

	const confirmReplaceDraft = useCallback(() => {
		setDecision("applied");
		setPrefillVersion((v) => v + 1);
	}, []);

	const keepExistingDraft = useCallback(() => {
		setDecision("dismissed");
	}, []);

	const applyDirectPrefill = useCallback(
		(suggestionId: string, prefill: QuickCreateContextResponse["prefill"]) => {
			if (isEditMode || !owner) return;
			setPending({
				hostId: owner,
				suggestionId,
				expiresAt: Date.now() + 60_000,
				prefill,
			});
			setDecision("applied");
			setPrefillVersion((v) => v + 1);
		},
		[isEditMode, owner]
	);

	const appliedValues = useMemo(() => {
		if (isEditMode || !pending || decision !== "applied") return undefined;
		return buildPrefillFormValues(pending);
	}, [isEditMode, pending, decision]);

	const needsConfirm = Boolean(
		!isEditMode && pending && decision === "pending" && draftSettled && hasExistingDraft
	);

	return {
		appliedValues,
		prefillVersion,
		suggestedMonth: decision === "applied" && pending ? pending.prefill.suggestedMonth : null,
		needsConfirm,
		isPrefillActive: Boolean(appliedValues),
		confirmReplaceDraft,
		keepExistingDraft,
		applyDirectPrefill,
	};
}
