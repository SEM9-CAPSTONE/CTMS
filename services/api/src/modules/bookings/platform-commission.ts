/**
 * Platform commission taken at settlement (BR-333, BR-337, BR-338): 5% to the platform, 95% to the
 * Host. One place so the settlement and the weather penalty base (policy §6) always agree.
 */
export const PLATFORM_COMMISSION_RATE = "0.0500";
const PLATFORM_COMMISSION_PERCENT = 5n;

/** Splits an amount in minor units into the platform fee (rounded down) and the Host's share. */
export function splitPlatformCommission(baseMinor: bigint): { feeMinor: bigint; netMinor: bigint } {
	const feeMinor = (baseMinor * PLATFORM_COMMISSION_PERCENT) / 100n;
	return { feeMinor, netMinor: baseMinor - feeMinor };
}
