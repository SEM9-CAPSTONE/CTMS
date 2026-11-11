import { join } from "node:path";

export const UPLOAD_PUBLIC_PREFIX = "/uploads/";

export function getUploadRoot(): string {
	const configuredRoot = process.env.UPLOAD_ROOT?.trim();

	return configuredRoot || join(process.cwd(), "uploads");
}
