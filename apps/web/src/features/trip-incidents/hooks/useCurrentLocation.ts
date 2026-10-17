import { useCallback, useState } from "react";
import { GEOLOCATION_MAX_AGE_MS, GEOLOCATION_TIMEOUT_MS } from "../constants";
import type { IncidentLocation } from "../types";

export type LocationRequestState = "idle" | "locating" | "located" | "unavailable";

/**
 * Reads one device fix for the incident. When the device cannot provide one the
 * location stays null; coordinates are never guessed (spec: "do not fabricate").
 */
export function useCurrentLocation() {
	const [location, setLocation] = useState<IncidentLocation | null>(null);
	const [state, setState] = useState<LocationRequestState>("idle");

	const locate = useCallback(() => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			setLocation(null);
			setState("unavailable");
			return;
		}
		setState("locating");
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setLocation({
					latitude: position.coords.latitude,
					longitude: position.coords.longitude,
					accuracyMeters: position.coords.accuracy,
					capturedAt: new Date(position.timestamp).toISOString(),
				});
				setState("located");
			},
			() => {
				setLocation(null);
				setState("unavailable");
			},
			{
				enableHighAccuracy: true,
				timeout: GEOLOCATION_TIMEOUT_MS,
				maximumAge: GEOLOCATION_MAX_AGE_MS,
			}
		);
	}, []);

	return { location, state, locate };
}
