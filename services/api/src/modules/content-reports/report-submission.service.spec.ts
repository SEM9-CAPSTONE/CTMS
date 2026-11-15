import { createHash, randomUUID } from "node:crypto";
import { type DataSource, type EntityManager, QueryFailedError } from "typeorm";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import type { UsersRepository } from "../users/users.repository";
import { ContentReportStatus } from "./content-report-status.enum";
import type { CreateContentReportDto } from "./dto/create-content-report.dto";
import type { ReportSubmissionRepository } from "./report-submission.repository";
import { ReportSubmissionService } from "./report-submission.service";
import {
	ContentReportType,
	REPORT_OPEN_TARGET_INDEX,
	ReportTargetType,
} from "./report-submission.types";

describe("ReportSubmissionService", () => {
	const actorId = randomUUID();
	const dto: CreateContentReportDto = {
		idempotencyKey: randomUUID(),
		reportType: ContentReportType.DANGEROUS_CONTENT,
		targetType: ReportTargetType.TRIP_REVIEW,
		targetId: randomUUID(),
		description: "Thông tin có thể gây nguy hiểm.",
	};
	const hash = createHash("sha256")
		.update(JSON.stringify([dto.reportType, dto.targetType, dto.targetId, dto.description]))
		.digest("hex");
	const stored = {
		id: randomUUID(),
		reportType: dto.reportType,
		targetType: dto.targetType,
		targetId: dto.targetId,
		description: dto.description,
		requestHash: hash,
		status: ContentReportStatus.PENDING,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
	let service: ReportSubmissionService;
	let reports: {
		findByKey: jest.Mock;
		canReportReview: jest.Mock;
		insert: jest.Mock;
		own: jest.Mock;
		listOwn: jest.Mock;
	};
	let audit: jest.Mock;
	let findUser: jest.Mock;

	beforeEach(() => {
		reports = {
			findByKey: jest.fn().mockResolvedValue(null),
			canReportReview: jest.fn().mockResolvedValue(true),
			insert: jest.fn().mockResolvedValue(stored),
			own: jest.fn().mockResolvedValue(stored),
			listOwn: jest.fn().mockResolvedValue({ items: [stored], total: 1 }),
		};
		audit = jest.fn().mockResolvedValue({});
		findUser = jest.fn().mockResolvedValue({ id: actorId, status: UserStatus.ACTIVE });
		const users = { findOneWithRolesById: findUser, getGrantedRoles: () => [UserRole.HOST] };
		const manager = {
			withRepository: () => users,
			getRepository: () => ({ save: audit }),
		} as unknown as EntityManager;
		const db = {
			manager,
			transaction: (work: (m: EntityManager) => Promise<unknown>) => work(manager),
		} as unknown as DataSource;
		service = new ReportSubmissionService(
			db,
			users as unknown as UsersRepository,
			reports as unknown as ReportSubmissionRepository
		);
	});

	it("persists submission and audit together without leaking hash", async () => {
		expect(await service.create(actorId, dto)).not.toHaveProperty("requestHash");
		expect(reports.insert).toHaveBeenCalledWith(expect.anything(), actorId, dto, hash);
		expect(audit).toHaveBeenCalledWith(
			expect.objectContaining({ action: "content_report.created" })
		);
	});
	it("replays a terminal report before checking current target access", async () => {
		reports.findByKey.mockResolvedValue({ ...stored, status: "actioned" });
		reports.canReportReview.mockResolvedValue(false);
		expect(await service.create(actorId, dto)).toMatchObject({ id: stored.id, status: "actioned" });
		expect(reports.canReportReview).not.toHaveBeenCalled();
		expect(audit).not.toHaveBeenCalled();
	});
	it("distinguishes reused key with changed content", async () => {
		reports.findByKey.mockResolvedValue({ ...stored, requestHash: "other" });
		await expect(service.create(actorId, dto)).rejects.toMatchObject({
			response: { code: "REPORT_IDEMPOTENCY_CONFLICT" },
		});
	});
	it("returns the same non-disclosing 404 when target access is denied", async () => {
		reports.canReportReview.mockResolvedValue(false);
		await expect(service.create(actorId, dto)).rejects.toMatchObject({
			status: 404,
			response: { code: "REPORT_TARGET_NOT_FOUND" },
		});
		expect(reports.insert).not.toHaveBeenCalled();
	});
	it("reads the concurrent winner after an open-target unique violation", async () => {
		reports.findByKey.mockResolvedValueOnce(null).mockResolvedValueOnce(stored);
		reports.insert.mockRejectedValue(
			new QueryFailedError(
				"INSERT",
				[],
				Object.assign(new Error("duplicate"), {
					code: "23505",
					constraint: REPORT_OPEN_TARGET_INDEX,
				})
			)
		);
		expect(await service.create(actorId, dto)).toMatchObject({ id: stored.id });
	});
	it("returns a separate error for another open submission", async () => {
		reports.insert.mockRejectedValue(
			new QueryFailedError(
				"INSERT",
				[],
				Object.assign(new Error("duplicate"), {
					code: "23505",
					constraint: REPORT_OPEN_TARGET_INDEX,
				})
			)
		);
		await expect(service.create(actorId, dto)).rejects.toMatchObject({
			response: { code: "REPORT_ALREADY_OPEN" },
		});
	});
	it("propagates audit failure to roll back the transaction", async () => {
		audit.mockRejectedValue(new Error("audit unavailable"));
		await expect(service.create(actorId, dto)).rejects.toThrow("audit unavailable");
	});
	it("rejects inactive users even for replay", async () => {
		findUser.mockResolvedValue({ status: UserStatus.SUSPENDED });
		await expect(service.create(actorId, dto)).rejects.toMatchObject({ status: 401 });
		expect(reports.findByKey).not.toHaveBeenCalled();
	});
	it("scopes detail and list to actor and strips internal hash", async () => {
		expect(await service.getOwn(actorId, stored.id)).not.toHaveProperty("requestHash");
		expect(reports.own).toHaveBeenCalledWith(expect.anything(), actorId, stored.id);
		const list = await service.listOwn(actorId, { page: 1, limit: 20 });
		expect(list.items[0]).not.toHaveProperty("requestHash");
		expect(list.pagination.totalPages).toBe(1);
	});
	it("hides another reporter's report", async () => {
		reports.own.mockResolvedValue(null);
		await expect(service.getOwn(actorId, stored.id)).rejects.toMatchObject({ status: 404 });
	});
});
