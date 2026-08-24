import { join } from "node:path";

export const UPLOAD_PUBLIC_PREFIX = "/uploads/";
export const CAMPSITE_UPLOAD_PUBLIC_PATH = `${UPLOAD_PUBLIC_PREFIX}campsites/`;
export const CAMPSITE_PENDING_UPLOAD_PUBLIC_PATH = `${CAMPSITE_UPLOAD_PUBLIC_PATH}pending/`;

export function getUploadRoot(): string {
	const configuredRoot = process.env.UPLOAD_ROOT?.trim();

	return configuredRoot || join(process.cwd(), "uploads");
}

export function getCampsiteUploadDir(): string {
	return join(getUploadRoot(), "campsites");
}

export function getCampsitePendingUploadDir(): string {
	return join(getCampsiteUploadDir(), "pending");
}
