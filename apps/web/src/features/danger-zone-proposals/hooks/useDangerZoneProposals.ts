import { useCallback, useEffect, useRef, useState } from "react";
import { dangerZoneProposalsService } from "../services/danger-zone-proposals.service";
import type { DangerZoneProposal, ProposalStatusFilter } from "../types";
import { proposalErrorMessage } from "../utils/proposal-errors";

type Loader = () => Promise<DangerZoneProposal[]>;

/** Loads a proposal list; stale responses from an earlier filter or route are dropped. */
function useProposalList(loader: Loader) {
	const [items, setItems] = useState<DangerZoneProposal[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const sequence = useRef(0);

	const reload = useCallback(async () => {
		const request = ++sequence.current;
		setLoading(true);
		setError(null);
		try {
			const next = await loader();
			if (request === sequence.current) setItems(next);
		} catch (failure) {
			if (request === sequence.current) {
				setItems([]);
				setError(proposalErrorMessage(failure));
			}
		} finally {
			if (request === sequence.current) setLoading(false);
		}
	}, [loader]);

	useEffect(() => {
		void reload();
		return () => {
			sequence.current += 1;
		};
	}, [reload]);

	return { items, loading, error, reload };
}

export function useDangerZoneProposals(status: ProposalStatusFilter) {
	const loader = useCallback(() => dangerZoneProposalsService.list(status), [status]);
	return useProposalList(loader);
}

export function useRouteDangerZoneProposals(routeId: string) {
	const loader = useCallback(() => dangerZoneProposalsService.listForRoute(routeId), [routeId]);
	return useProposalList(loader);
}
