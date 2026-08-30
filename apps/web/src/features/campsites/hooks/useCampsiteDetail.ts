import { useCallback, useEffect, useState } from "react";
import { campsitesService } from "../services/campsites.service";
import type { CampsiteDetail } from "../types";
import { mapCampsiteDetailError } from "../utils/campsites.utils";

export function useCampsiteDetail(campsiteId: string) {
	const [campsite, setCampsite] = useState<CampsiteDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await campsitesService.getPublicDetail(campsiteId);
			setCampsite(data);
		} catch (err) {
			setError(mapCampsiteDetailError(err));
		} finally {
			setIsLoading(false);
		}
	}, [campsiteId]);

	useEffect(() => {
		void load();
	}, [load]);

	return {
		campsite,
		isLoading,
		error,
		reload: load,
	};
}
