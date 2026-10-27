import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { queryKeys } from "../../../core/api";
import {
	type TripFormDraftSummary,
	tripFormDraftsService,
} from "../services/trip-form-drafts.service";
import { draftOwner, readDraftCache, restoreCachedDraft } from "../utils/trip-draft-cache";
export function TripDraftCover({ draft }: { draft: TripFormDraftSummary }) {
	const { data } = useQuery({
		queryKey: queryKeys.trips.formDraftThumbnail(draft.id, draft.updatedAt),
		enabled: draft.imageCount > 0,
		staleTime: 60000,
		gcTime: 60000,
		retry: false,
		queryFn: async () => {
			const local = readDraftCache(draftOwner(), draft.id);
			if (local && (local.dirty || draft.syncPending)) {
				const restored = await restoreCachedDraft(local);
				return restored.images[0] ?? null;
			}
			const image = await tripFormDraftsService.thumbnail(draft.id);
			if (!image) return null;
			const bytes = Uint8Array.from(atob(image.base64), (c) => c.charCodeAt(0));
			return new Blob([bytes], { type: image.type });
		},
	});
	const [url, setUrl] = useState("");
	useEffect(() => {
		if (!data) {
			setUrl("");
			return;
		}
		const next = URL.createObjectURL(data);
		setUrl(next);
		return () => URL.revokeObjectURL(next);
	}, [data]);
	return url ? (
		<img
			src={url}
			alt={draft.title?.trim() || "Ảnh bìa chuyến đi nháp"}
			className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
			loading="lazy"
		/>
	) : (
		<div className="flex size-full items-center justify-center text-[#8fa096]">
			<ImageIcon className="size-10" aria-label="Chưa có ảnh bìa" />
		</div>
	);
}
