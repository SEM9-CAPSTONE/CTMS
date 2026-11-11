export const MAX_TRIP_IMAGES = 5;
export const TRIP_IMAGE_SLOT_IDS = ["slot-a", "slot-b", "slot-c", "slot-d", "slot-e"] as const;
export const MAX_TRIP_IMAGE_BYTES = 5 * 1024 * 1024;
export const TRIP_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export function isValidTripImage(file: File): boolean {
	return (
		TRIP_IMAGE_TYPES.some((type) => type === file.type) &&
		file.size > 0 &&
		file.size <= MAX_TRIP_IMAGE_BYTES
	);
}
