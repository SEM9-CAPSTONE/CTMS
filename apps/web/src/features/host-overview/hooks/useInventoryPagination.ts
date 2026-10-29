import { useEffect, useState } from "react";
import type { OverviewInventoryTab } from "../types";
import { useHostOverview } from "./useHostOverview";

export function useInventoryPagination(
	hostId: string,
	active: OverviewInventoryTab,
	onRestricted: () => void
) {
	const [pages, setPages] = useState<Record<OverviewInventoryTab, number>>({
		bookings: 1,
		porters: 1,
		routes: 1,
	});
	const page = pages[active];
	const query = useHostOverview(hostId, page);
	useEffect(() => {
		if (query.restricted) onRestricted();
	}, [query.restricted, onRestricted]);
	const setPage = (value: number) => setPages((current) => ({ ...current, [active]: value }));
	return { query, page, setPage };
}
