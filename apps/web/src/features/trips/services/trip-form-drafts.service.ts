import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { CreateTripFormValues } from "../schema/create-trip.schema";
export interface TripFormDraftSummary {
	id: string;
	title: string;
	updatedAt: string;
	imageCount: number;
	tripId?: string | null;
	syncPending?: boolean;
	startsAt?: string;
	endsAt?: string;
	capacityMax?: string;
	pricePerPerson?: string;
}
export interface TripFormDraft {
	id: string;
	values: CreateTripFormValues;
	tripId?: string | null;
	images: { name: string; type: string; base64: string }[];
}
export const tripFormDraftsService = {
	list: () => httpClient.get<TripFormDraftSummary[]>(API_ENDPOINTS.TRIPS.FORM_DRAFTS),
	thumbnail: (id: string) =>
		httpClient.get<{ name: string; type: string; base64: string } | null>(
			`${API_ENDPOINTS.TRIPS.FORM_DRAFT(id)}/thumbnail`
		),
	get: (id: string) => httpClient.get<TripFormDraft>(API_ENDPOINTS.TRIPS.FORM_DRAFT(id)),
	save: (
		id: string,
		values: CreateTripFormValues,
		images: File[],
		tripId?: string,
		preserveImages = false
	) => {
		const form = new FormData();
		form.append("values", JSON.stringify(values));
		if (tripId) form.append("tripId", tripId);
		if (preserveImages) form.append("preserveImages", "true");
		else for (const image of images) form.append("images", image);
		return httpClient.put<{ id: string }>(API_ENDPOINTS.TRIPS.FORM_DRAFT(id), form);
	},
	complete: (id: string, tripId: string) =>
		httpClient.post(API_ENDPOINTS.TRIPS.COMPLETE_FORM_DRAFT(id), { tripId }),
};
export function restoreDraftImages(draft: TripFormDraft): File[] {
	return draft.images.map((image) => {
		const raw = atob(image.base64);
		const bytes = new Uint8Array(raw.length);
		for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		return new File([bytes], image.name, { type: image.type });
	});
}
