/**
 * CTMS-110. Exact money arithmetic for aggregated ledger sums. Postgres returns `numeric` sums as
 * text; they are parsed into integer minor units so totals never drift through floats.
 */
export function sumToMinor(value: string | number | null | undefined): bigint {
	if (value === null || value === undefined || value === "") return 0n;
	const text = String(value).trim();
	const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(text);
	if (!match) throw new Error(`Invalid aggregated monetary amount: ${text}`);
	const fraction = (match[3] ?? "").padEnd(2, "0").slice(0, 2);
	const minor = BigInt(match[2]) * 100n + BigInt(fraction);
	return match[1] ? -minor : minor;
}

/** Converts minor units back to the reporting-currency amount returned by the API. */
export function minorToAmount(value: bigint): number {
	return Number(value) / 100;
}
