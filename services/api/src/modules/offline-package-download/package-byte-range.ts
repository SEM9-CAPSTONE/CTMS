export interface PackageByteRange {
	start: number;
	end: number;
}

/** A single RFC byte range. null means unsatisfiable/unsupported; undefined means full body. */
export function packageByteRange(
	header: string | undefined,
	size: number
): PackageByteRange | null | undefined {
	if (header === undefined) return undefined;
	const match = /^bytes=(\d*)-(\d*)$/.exec(header);
	if (!match || (!match[1] && !match[2])) return null;
	if (!match[1]) {
		const suffix = Number(match[2]);
		if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
		return { start: Math.max(0, size - suffix), end: size - 1 };
	}
	const start = Number(match[1]);
	const end = match[2] ? Number(match[2]) : size - 1;
	if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start)
		return null;
	return { start, end: Math.min(end, size - 1) };
}
