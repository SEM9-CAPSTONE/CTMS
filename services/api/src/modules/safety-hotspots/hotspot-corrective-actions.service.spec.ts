import { ConflictException, NotFoundException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateCorrectiveActionDto } from "./dto/corrective-action.dto";
import type {
	HotspotCorrectiveActionsRepository,
	LockedHotspot,
} from "./hotspot-corrective-actions.repository";
import {
	CorrectiveActionErrorCode,
	HotspotCorrectiveActionsService,
	packageImpactOf,
} from "./hotspot-corrective-actions.service";
import type { HotspotPackageImpactDispatcher } from "./hotspot-package-impact.dispatcher";
import { CorrectiveActionType, PackageImpact, SafetyHotspotStatus } from "./safety-hotspots.enums";

const ACTOR = "6f1c1d1e-0000-4000-8000-000000000001";
const HOTSPOT = "6f1c1d1e-0000-4000-8000-000000000002";
const ROUTE = "6f1c1d1e-0000-4000-8000-000000000003";
const CHECKPOINT = "6f1c1d1e-0000-4000-8000-000000000004";
const REASON = "Nhiều đoàn rẽ nhầm tại ngã ba suối, bổ sung hướng dẫn rẽ trái theo cọc tiêu đỏ.";

function hotspot(status: SafetyHotspotStatus): LockedHotspot {
	return {
		id: HOTSPOT,
		routeId: ROUTE,
		routeVersion: "a".repeat(32),
		status,
		statusChangedAt: new Date("2026-11-10T03:00:00Z"),
		evidenceHash: "b".repeat(64),
	};
}

function setup(options: { status?: SafetyHotspotStatus; routeStatus?: string | null } = {}) {
	const auditSave = jest.fn().mockResolvedValue(undefined);
	const manager = { query: jest.fn(), getRepository: jest.fn(() => ({ save: auditSave })) };
	const repository = {
		transaction: jest.fn((work: (m: unknown) => Promise<unknown>) => work(manager)),
		lockHotspot: jest
			.fn()
			.mockResolvedValue(hotspot(options.status ?? SafetyHotspotStatus.CONFIRMED)),
		lockRouteStatus: jest
			.fn()
			.mockResolvedValue(options.routeStatus === undefined ? "active" : options.routeStatus),
		findPublishedTripIds: jest.fn().mockResolvedValue(["trip-1", "trip-2"]),
		insert: jest.fn().mockResolvedValue("action-1"),
		recordPackageImpacts: jest.fn(),
		findById: jest.fn().mockResolvedValue({ id: "action-1" }),
	};
	const checkpoints = {
		updateSafetyInstructionsCorrective: jest.fn().mockResolvedValue({
			result: { id: CHECKPOINT },
			before: { instructions: "Đi thẳng" },
			after: { instructions: "Rẽ trái theo cọc tiêu đỏ" },
		}),
	};
	const dangerZones = { createCorrective: jest.fn(), updateCorrective: jest.fn() };
	const impacts = { dispatch: jest.fn().mockResolvedValue(true) };
	const service = new HotspotCorrectiveActionsService(
		repository as unknown as HotspotCorrectiveActionsRepository,
		checkpoints as never,
		dangerZones as never,
		impacts as unknown as HotspotPackageImpactDispatcher
	);
	return { service, repository, checkpoints, dangerZones, impacts, auditSave };
}

const instructionsDto = (): CreateCorrectiveActionDto =>
	plainToInstance(CreateCorrectiveActionDto, {
		actionType: CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS,
		reason: REASON,
		checkpointId: CHECKPOINT,
		instructions: "Rẽ trái theo cọc tiêu đỏ",
	});

describe("HotspotCorrectiveActionsService (CTMS-118)", () => {
	it.each([
		SafetyHotspotStatus.DETECTED,
		SafetyHotspotStatus.UNDER_REVIEW,
		SafetyHotspotStatus.DISMISSED,
	])("rejects a %s hotspot without touching Route data (BR-358)", async (status) => {
		const { service, checkpoints, repository } = setup({ status });
		await expect(service.create(ACTOR, HOTSPOT, instructionsDto())).rejects.toMatchObject({
			response: { code: CorrectiveActionErrorCode.HOTSPOT_NOT_CONFIRMED },
		});
		expect(checkpoints.updateSafetyInstructionsCorrective).not.toHaveBeenCalled();
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it("rejects a call without a human actor (BR-356)", async () => {
		const { service, repository } = setup();
		await expect(service.create(null, HOTSPOT, instructionsDto())).rejects.toBeInstanceOf(
			ConflictException
		);
		expect(repository.transaction).not.toHaveBeenCalled();
	});

	it("rejects an unknown hotspot", async () => {
		const { service, repository } = setup();
		repository.lockHotspot.mockResolvedValue(null);
		await expect(service.create(ACTOR, HOTSPOT, instructionsDto())).rejects.toBeInstanceOf(
			NotFoundException
		);
	});

	it("rejects a correction on a closed Route", async () => {
		const { service } = setup({ routeStatus: "closed" });
		await expect(service.create(ACTOR, HOTSPOT, instructionsDto())).rejects.toMatchObject({
			response: { code: CorrectiveActionErrorCode.ROUTE_CLOSED },
		});
	});

	it("rejects a checkpoint that is not on the hotspot's Route", async () => {
		const { service, checkpoints, repository } = setup();
		checkpoints.updateSafetyInstructionsCorrective.mockResolvedValue(null);
		await expect(service.create(ACTOR, HOTSPOT, instructionsDto())).rejects.toMatchObject({
			response: { code: CorrectiveActionErrorCode.TARGET_NOT_ON_ROUTE },
		});
		expect(checkpoints.updateSafetyInstructionsCorrective).toHaveBeenCalledWith(
			expect.anything(),
			ROUTE,
			CHECKPOINT,
			"Rẽ trái theo cọc tiêu đỏ"
		);
		expect(repository.insert).not.toHaveBeenCalled();
	});

	it("applies, audits and links the evidence, then requests new package versions (BR-191/419/359)", async () => {
		const { service, repository, auditSave, impacts } = setup();
		await service.create(ACTOR, HOTSPOT, instructionsDto());

		expect(repository.insert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				hotspotId: HOTSPOT,
				routeId: ROUTE,
				targetType: "trekking_route_checkpoint",
				targetId: CHECKPOINT,
				before: { instructions: "Đi thẳng" },
				after: { instructions: "Rẽ trái theo cọc tiêu đỏ" },
				hotspotEvidenceHash: "b".repeat(64),
				packageImpact: PackageImpact.AFFECTED,
				impactTripIds: ["trip-1", "trip-2"],
				actorId: ACTOR,
			})
		);
		expect(auditSave).toHaveBeenCalledWith(
			expect.objectContaining({
				actorId: ACTOR,
				action: "safety_hotspot.corrective_action",
				targetId: CHECKPOINT,
				before: { instructions: "Đi thẳng" },
			})
		);
		expect(impacts.dispatch).toHaveBeenCalledWith(
			"action-1",
			["trip-1", "trip-2"],
			expect.any(Date)
		);
	});

	it("does not enqueue a correction with unchanged instructions", async () => {
		const { service, checkpoints, repository, impacts } = setup();
		checkpoints.updateSafetyInstructionsCorrective.mockResolvedValue({
			result: { id: CHECKPOINT },
			before: { instructions: "Keep to the marked trail" },
			after: { instructions: "Keep to the marked trail" },
		});
		await service.create(ACTOR, HOTSPOT, instructionsDto());
		expect(repository.recordPackageImpacts).not.toHaveBeenCalled();
		expect(impacts.dispatch).not.toHaveBeenCalled();
	});

	it("records a no-data-change decision without touching Route data or packages (BR-423)", async () => {
		const { service, repository, checkpoints, impacts } = setup();
		const dto = plainToInstance(CreateCorrectiveActionDto, {
			actionType: CorrectiveActionType.NO_DATA_CHANGE,
			reason: "Đoạn lệch là lối tắt an toàn đã có biển chỉ dẫn, không cần thay đổi dữ liệu.",
		});
		await service.create(ACTOR, HOTSPOT, dto);
		expect(checkpoints.updateSafetyInstructionsCorrective).not.toHaveBeenCalled();
		expect(repository.findPublishedTripIds).not.toHaveBeenCalled();
		expect(repository.insert).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				targetType: null,
				targetId: null,
				packageImpact: PackageImpact.NOT_AFFECTED,
				impactTripIds: [],
			})
		);
		expect(impacts.dispatch).not.toHaveBeenCalled();
	});

	it("maps package impact per action type", () => {
		expect(packageImpactOf(CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS)).toBe(
			PackageImpact.AFFECTED
		);
		for (const type of [
			CorrectiveActionType.ADD_HAZARD_AREA,
			CorrectiveActionType.UPDATE_HAZARD_AREA,
			CorrectiveActionType.NO_DATA_CHANGE,
			CorrectiveActionType.OTHER,
		]) {
			expect(packageImpactOf(type)).toBe(PackageImpact.NOT_AFFECTED);
		}
	});
});

describe("CreateCorrectiveActionDto", () => {
	const errorsOf = async (plain: Record<string, unknown>) =>
		(await validate(plainToInstance(CreateCorrectiveActionDto, plain))).map(
			(error) => error.property
		);

	it("requires a reason for every action, including no-data-change", async () => {
		expect(
			await errorsOf({ actionType: CorrectiveActionType.NO_DATA_CHANGE, reason: "  ngắn  " })
		).toContain("reason");
	});

	it("rejects geometry changes, which are not a supported action type", async () => {
		expect(await errorsOf({ actionType: "UPDATE_ROUTE_GEOMETRY", reason: REASON })).toContain(
			"actionType"
		);
	});

	it("requires the target fields of each action type", async () => {
		expect(
			await errorsOf({
				actionType: CorrectiveActionType.UPDATE_CHECKPOINT_INSTRUCTIONS,
				reason: REASON,
			})
		).toEqual(expect.arrayContaining(["checkpointId", "instructions"]));
		expect(
			await errorsOf({ actionType: CorrectiveActionType.UPDATE_HAZARD_AREA, reason: REASON })
		).toEqual(expect.arrayContaining(["hazardArea", "hazardAreaId"]));
	});

	it("validates a hazard area with the Host creation rules", async () => {
		expect(
			await errorsOf({
				actionType: CorrectiveActionType.ADD_HAZARD_AREA,
				reason: REASON,
				hazardArea: {
					geometry: { type: "Point", coordinates: [200, 16] },
					description: "",
					severity: "x",
				},
			})
		).toContain("hazardArea");
		expect(
			await errorsOf({
				actionType: CorrectiveActionType.ADD_HAZARD_AREA,
				reason: REASON,
				hazardArea: {
					geometry: { type: "Point", coordinates: [108.24, 16.06] },
					radiusMeters: 40,
					description: "Vách đá trơn trượt sau mưa",
					severity: "high",
				},
			})
		).toEqual([]);
	});
});
