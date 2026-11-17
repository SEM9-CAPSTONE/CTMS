import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { DataSource } from "typeorm";
import { ReviewSafetyHotspotDto } from "./dto/review-safety-hotspot.dto";
import { HotspotReviewErrorCode, HotspotReviewService } from "./hotspot-review.service";
import { SafetyHotspotStatus } from "./safety-hotspots.enums";

const ACTOR = "6f1c1d1e-0000-4000-8000-000000000001";
const HOTSPOT = "6f1c1d1e-0000-4000-8000-000000000002";
const REASON = "Đối chiếu nhật ký của Host và các lần lệch tuyến tại ngã ba suối.";
const EVIDENCE_HASH = "b".repeat(64);
const DECISIONS = [SafetyHotspotStatus.CONFIRMED, SafetyHotspotStatus.DISMISSED] as const;

function setup(status: SafetyHotspotStatus | null) {
	const auditSave = jest.fn().mockResolvedValue(undefined);
	const manager = {
		query: jest.fn().mockResolvedValue([]),
		getRepository: jest.fn(() => ({ save: auditSave })),
	};
	manager.query.mockResolvedValueOnce(status ? [{ status, evidenceHash: EVIDENCE_HASH }] : []);
	const dataSource = {
		transaction: jest.fn((work: (m: typeof manager) => Promise<void>) => work(manager)),
	};
	return {
		service: new HotspotReviewService(dataSource as unknown as DataSource),
		manager,
		auditSave,
	};
}

describe("HotspotReviewService direct Admin decisions", () => {
	it.each([
		[SafetyHotspotStatus.DETECTED, SafetyHotspotStatus.CONFIRMED],
		[SafetyHotspotStatus.DETECTED, SafetyHotspotStatus.DISMISSED],
		[SafetyHotspotStatus.UNDER_REVIEW, SafetyHotspotStatus.CONFIRMED],
		[SafetyHotspotStatus.UNDER_REVIEW, SafetyHotspotStatus.DISMISSED],
	] as const)(
		"decides %s → %s and records the actual previous state and evidence",
		async (from, to) => {
			const { service, manager, auditSave } = setup(from);
			await service.review(ACTOR, HOTSPOT, { status: to, reason: REASON });
			expect(manager.query).toHaveBeenNthCalledWith(2, expect.stringContaining("UPDATE"), [
				HOTSPOT,
				to,
			]);
			expect(manager.query).toHaveBeenNthCalledWith(
				3,
				expect.stringContaining('INSERT INTO "hotspot_reviews"'),
				[HOTSPOT, ACTOR, from, to, REASON, EVIDENCE_HASH]
			);
			expect(auditSave).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: ACTOR,
					before: { status: from },
					after: { status: to, evidenceHash: EVIDENCE_HASH },
					reason: REASON,
				})
			);
		}
	);

	it.each(DECISIONS.flatMap((from) => DECISIONS.map((to) => [from, to] as const)))(
		"does not change a finalized %s hotspot to %s or duplicate its history",
		async (from, to) => {
			const { service, manager, auditSave } = setup(from);
			await expect(
				service.review(ACTOR, HOTSPOT, { status: to, reason: REASON })
			).rejects.toMatchObject({
				response: { code: HotspotReviewErrorCode.INVALID_TRANSITION },
			});
			expect(manager.query).toHaveBeenCalledTimes(1);
			expect(auditSave).not.toHaveBeenCalled();
		}
	);

	it("rejects an unknown hotspot without writing a decision", async () => {
		const { service, manager } = setup(null);
		await expect(
			service.review(ACTOR, HOTSPOT, { status: SafetyHotspotStatus.CONFIRMED, reason: REASON })
		).rejects.toMatchObject({
			response: { code: HotspotReviewErrorCode.HOTSPOT_NOT_FOUND },
		});
		expect(manager.query).toHaveBeenCalledTimes(1);
	});
});

describe("ReviewSafetyHotspotDto", () => {
	it.each(DECISIONS)("accepts a direct %s decision and trims the reason", async (status) => {
		const dto = plainToInstance(ReviewSafetyHotspotDto, { status, reason: `  ${REASON}  ` });
		expect(await validate(dto)).toHaveLength(0);
		expect(dto.reason).toBe(REASON);
	});

	it.each([SafetyHotspotStatus.UNDER_REVIEW, SafetyHotspotStatus.DETECTED])(
		"rejects %s as a decision target",
		async (status) => {
			const dto = plainToInstance(ReviewSafetyHotspotDto, { status, reason: REASON });
			expect(await validate(dto)).toEqual(
				expect.arrayContaining([expect.objectContaining({ property: "status" })])
			);
		}
	);

	it("still requires a meaningful reason", async () => {
		const dto = plainToInstance(ReviewSafetyHotspotDto, {
			status: SafetyHotspotStatus.CONFIRMED,
			reason: "   ",
		});
		expect(await validate(dto)).toEqual(
			expect.arrayContaining([expect.objectContaining({ property: "reason" })])
		);
	});
});
