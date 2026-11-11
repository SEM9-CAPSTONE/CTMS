import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/api/queryKeys";
import { camperProfileService } from "../services/camper-profile.service";

export function useCurrentUserProfile() {
	return useQuery({
		queryKey: queryKeys.profile.me,
		queryFn: () => camperProfileService.getProfile(),
		staleTime: 60_000,
	});
}
