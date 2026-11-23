import {
	addWorkingDays,
	hostingBlockedUntil,
	hostingRestriction,
	isPenaltyDue,
	paymentDueAt,
	penaltyAmountMinor,
	penaltyBaseMinor,
	penaltyTier,
	waiverRequestDeadline,
} from "./host-weather-penalty.policy";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-16T03:00:00.000Z"); // Monday 10:00 in Vietnam

/** An applied penalty that is fully paid and blocks nothing by itself. */
function applied(createdAt: Date, hostingBlockedUntil: Date | null = null) {
	return {
		createdAt,
		hostingBlockedUntil,
		outstandingMinor: 0n,
		paymentDueAt: paymentDueAt(createdAt),
	};
}

describe("host weather penalty policy (§6)", () => {
	it("uses 5% / 10% / 15% with the 2M / 5M / 10M caps, the 3rd tier repeating", () => {
		expect(penaltyTier(1)).toMatchObject({ rateBasisPoints: 500, capVnd: 2_000_000 });
		expect(penaltyTier(2)).toMatchObject({ rateBasisPoints: 1000, capVnd: 5_000_000 });
		expect(penaltyTier(3)).toMatchObject({ rateBasisPoints: 1500, capVnd: 10_000_000 });
		expect(penaltyTier(7)).toBe(penaltyTier(3));
	});

	it("computes the amount in minor units and applies the cap", () => {
		// 12,000,000đ × 5% = 600,000đ
		expect(penaltyAmountMinor(1_200_000_000n, penaltyTier(1))).toBe(60_000_000n);
		// 100,000,000đ × 5% = 5,000,000đ, capped at 2,000,000đ
		expect(penaltyAmountMinor(10_000_000_000n, penaltyTier(1))).toBe(200_000_000n);
		expect(penaltyAmountMinor(0n, penaltyTier(2))).toBe(0n);
	});

	it("takes the base from the Host's 95% share of the paid bookings, rounded like the settlement", () => {
		// 1,500,000đ paid − 5% commission (75,000đ) = 1,425,000đ; 5% of it = 71,250đ
		expect(penaltyBaseMinor(150_000_000n)).toBe(142_500_000n);
		expect(penaltyAmountMinor(penaltyBaseMinor(150_000_000n), penaltyTier(1))).toBe(7_125_000n);
		// The commission is rounded down, so the Host's share keeps the odd minor unit.
		expect(penaltyBaseMinor(1_999n)).toBe(1_900n);
		expect(penaltyBaseMinor(0n)).toBe(0n);
	});

	it("gives the Host 7 days to pay and blocks only an unpaid amount past that deadline", () => {
		const created = new Date(NOW.getTime() - 8 * DAY);
		expect(paymentDueAt(created)).toEqual(new Date(created.getTime() + 7 * DAY));
		const overdue = { ...applied(created), outstandingMinor: 7_125_000n };
		const notYetDue = { ...applied(new Date(NOW.getTime() - DAY)), outstandingMinor: 500_000n };
		expect(hostingRestriction([overdue, notYetDue], NOW)).toEqual({
			blockedUntil: null,
			suspended: false,
			overdueDebtMinor: 7_125_000n,
		});
		expect(hostingRestriction([applied(created)], NOW).overdueDebtMinor).toBe(0n);
	});

	it("blocks hosting 14 days at tier 2 and leaves tiers 1 and 3 without a dated block", () => {
		expect(hostingBlockedUntil(penaltyTier(1), NOW)).toBeNull();
		expect(hostingBlockedUntil(penaltyTier(2), NOW)).toEqual(new Date(NOW.getTime() + 14 * DAY));
		expect(hostingBlockedUntil(penaltyTier(3), NOW)).toBeNull();
	});

	it("suspends while 3 applied penalties fall in 90 days and keeps the latest dated block", () => {
		const recent = (days: number) => new Date(NOW.getTime() - days * DAY);
		expect(hostingRestriction([], NOW)).toEqual({
			blockedUntil: null,
			suspended: false,
			overdueDebtMinor: 0n,
		});
		const blocked = new Date(NOW.getTime() + 3 * DAY);
		expect(hostingRestriction([applied(recent(11), blocked), applied(recent(40))], NOW)).toEqual({
			blockedUntil: blocked,
			suspended: false,
			overdueDebtMinor: 0n,
		});
		const three = hostingRestriction(
			[applied(recent(1)), applied(recent(20)), applied(recent(80))],
			NOW
		);
		// Lifted when the oldest of the three leaves the 90-day window.
		expect(three).toEqual({
			blockedUntil: new Date(NOW.getTime() + 10 * DAY),
			suspended: true,
			overdueDebtMinor: 0n,
		});
		expect(
			hostingRestriction([applied(recent(1)), applied(recent(20)), applied(recent(95))], NOW)
				.suspended
		).toBe(false);
	});

	it("is due only on the first Admin decision at or after T-24h without an on-time Host answer", () => {
		const startsAt = new Date(NOW.getTime() + 10 * HOUR);
		const base = { startsAt, now: NOW, adminAlreadyDecided: false, hostAnsweredOnTime: false };
		expect(isPenaltyDue(base)).toBe(true);
		expect(isPenaltyDue({ ...base, startsAt: new Date(NOW.getTime() + 24 * HOUR) })).toBe(true);
		expect(isPenaltyDue({ ...base, startsAt: new Date(NOW.getTime() + 30 * HOUR) })).toBe(false);
		expect(isPenaltyDue({ ...base, hostAnsweredOnTime: true })).toBe(false);
		expect(isPenaltyDue({ ...base, adminAlreadyDecided: true })).toBe(false);
	});

	it("closes the waiver request 72 h after T-24h and counts 5 working days for the review", () => {
		const startsAt = new Date("2026-11-20T00:00:00.000Z");
		expect(waiverRequestDeadline(startsAt)).toEqual(new Date("2026-11-22T00:00:00.000Z"));
		// Friday 10:00 VN + 5 working days = next Friday, skipping the weekend.
		const friday = new Date("2026-11-20T03:00:00.000Z");
		expect(addWorkingDays(friday, 5)).toEqual(new Date("2026-11-27T03:00:00.000Z"));
	});
});
