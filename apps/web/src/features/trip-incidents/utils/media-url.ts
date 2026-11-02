/**
 * Resolves relative media URLs (e.g. "/uploads/...") against the API server origin.
 * Absolute URLs (e.g. Cloudinary, S3) are returned unchanged.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	if (url.startsWith("http://") || url.startsWith("https://")) {
		return url;
	}
	const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
	const origin = apiBase.replace(/\/api\/?$/, "");
	return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
