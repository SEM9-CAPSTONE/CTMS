import { type ReactNode, createContext, useContext } from "react";
import { type SosRealtimeState, useHostSosRealtime } from "../hooks/useHostSosRealtime";

const SosRealtimeContext = createContext<SosRealtimeState | null>(null);

/** CTMS-079-T02: one authenticated SOS socket per Host session; renders nothing itself. */
export function HostSosRealtimeProvider({
	enabled,
	children,
}: {
	enabled: boolean;
	children: ReactNode;
}) {
	const state = useHostSosRealtime({ enabled });
	return (
		<SosRealtimeContext.Provider value={enabled ? state : null}>
			{children}
		</SosRealtimeContext.Provider>
	);
}

/** Null outside a Host session, so the status is simply not shown there. */
export function useSosRealtimeState(): SosRealtimeState | null {
	return useContext(SosRealtimeContext);
}
