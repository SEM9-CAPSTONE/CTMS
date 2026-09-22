import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnauthorizedException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { User, UserRole, UserStatus } from "../users/entities/user.entity";
import { UsersRepository } from "../users/users.repository";
import { ContentReportStatus as Status } from "./content-report-status.enum";
import { ContentReportsRepository } from "./content-reports.repository";
import { ContentReportsService } from "./content-reports.service";
import { ContentReport } from "./entities/content-report.entity";

const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const reportId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reporterId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function reportFixture(): ContentReport {
	return Object.assign(new ContentReport(), {
		id: reportId,
		reporterId,
		targetType: "opaque-domain",
		targetId: actorId,
		reason: "Private reporter reason",
		status: Status.PENDING,
		createdAt: new Date("2026-08-01T00:00:00Z"),
		updatedAt: new Date("2026-08-01T00:00:00Z"),
	});
}

describe("ContentReportsService", () => {
	let service: ContentReportsService;
	let persisted: ContentReport;
	const reports = {
		findOneBy: jest.fn(),
		findForUpdate: jest.fn(),
		save: jest.fn(),
		findQueue: jest.fn(),
	};
	const users = { findOneWithRolesById: jest.fn(), getGrantedRoles: jest.fn() };
	const reporterRead = jest.fn();
	const auditSave = jest.fn();
	const getRepository = jest.fn((entity: unknown) => {
		if (entity === User) return { findOneOrFail: reporterRead };
		if (entity === AuditLog) return { save: auditSave };
		throw new Error("Unexpected target workflow repository access");
	});
	const manager = {
		withRepository: jest.fn((repository: unknown) => repository),
		getRepository,
	} as unknown as EntityManager;
	const transaction = jest.fn();

	beforeEach(async () => {
		jest.clearAllMocks();
		persisted = reportFixture();
		users.findOneWithRolesById.mockResolvedValue({ id: actorId, status: UserStatus.ACTIVE });
		users.getGrantedRoles.mockReturnValue([UserRole.ADMIN]);
		reports.findOneBy.mockImplementation(async () => ({ ...persisted }));
		reports.findForUpdate.mockImplementation(async () => ({ ...persisted }));
		reports.save.mockImplementation(async (report: ContentReport) => report);
		reporterRead.mockResolvedValue({
			id: reporterId,
			fullName: "Reporter",
			passwordHash: "secret",
		});
		auditSave.mockResolvedValue({});
		// Models transaction commit for unit isolation; PostgreSQL rollback is tested separately.
		transaction.mockImplementation(async (work: (em: EntityManager) => Promise<unknown>) => {
			const result = await work(manager);
			const saved: ContentReport | undefined = reports.save.mock.calls[0]?.[0];
			if (saved) persisted = { ...saved };
			return result;
		});
		const module = await Test.createTestingModule({
			providers: [
				ContentReportsService,
				{ provide: ContentReportsRepository, useValue: reports },
				{ provide: UsersRepository, useValue: users },
				{ provide: DataSource, useValue: { manager, transaction } },
			],
		}).compile();
		service = module.get(ContentReportsService);
	});

	describe("listReports", () => {
		it("maps safe authoritative queue data without reporter queries, writes or audit", async () => {
			const row = {
				...persisted,
				reporter: Object.assign(new User(), {
					id: reporterId,
					fullName: "Reporter",
					passwordHash: "secret",
				}),
			};
			reports.findQueue.mockResolvedValue([[row], 3]);
			const result = await service.listReports(actorId, { page: 2, limit: 1 });
			expect(result.pagination).toEqual({ page: 2, limit: 1, total: 3, totalPages: 3 });
			expect(result.items[0]).toMatchObject({
				id: reportId,
				reporter: { id: reporterId, fullName: "Reporter" },
				status: Status.PENDING,
			});
			expect(Object.keys(result.items[0].reporter)).toEqual(["id", "fullName"]);
			expect(reporterRead).not.toHaveBeenCalled();
			expect(reports.save).not.toHaveBeenCalled();
			expect(auditSave).not.toHaveBeenCalled();
		});
		it("returns empty pagination", async () => {
			reports.findQueue.mockResolvedValue([[], 0]);
			await expect(service.listReports(actorId, { page: 1, limit: 20 })).resolves.toEqual({
				items: [],
				pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
			});
		});
		it("rejects non-Admin before querying queue", async () => {
			users.getGrantedRoles.mockReturnValue([UserRole.CAMPER]);
			await expect(service.listReports(actorId, { page: 1, limit: 20 })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(reports.findQueue).not.toHaveBeenCalled();
		});
	});

	describe("getReport", () => {
		it("returns authoritative fields and minimal reporter identity", async () => {
			const result = await service.getReport(actorId, reportId);
			expect(result).toEqual({
				id: reportId,
				reporter: { id: reporterId, fullName: "Reporter" },
				targetType: persisted.targetType,
				targetId: persisted.targetId,
				reason: persisted.reason,
				status: persisted.status,
				createdAt: persisted.createdAt,
				updatedAt: persisted.updatedAt,
			});
			expect(reporterRead).toHaveBeenCalledWith({
				where: { id: reporterId },
				select: { id: true, fullName: true },
			});
		});
		it("returns 404 for a missing report", async () => {
			reports.findOneBy.mockResolvedValueOnce(null);
			await expect(service.getReport(actorId, reportId)).rejects.toBeInstanceOf(NotFoundException);
		});
		it("rejects non-admin before reading a report", async () => {
			users.getGrantedRoles.mockReturnValue([UserRole.CAMPER]);
			await expect(service.getReport(actorId, reportId)).rejects.toBeInstanceOf(ForbiddenException);
			expect(reports.findOneBy).not.toHaveBeenCalled();
		});
	});

	describe("transition", () => {
		it.each([
			[Status.PENDING, Status.REVIEWING],
			[Status.PENDING, Status.ACTIONED],
			[Status.PENDING, Status.REJECTED],
			[Status.REVIEWING, Status.ACTIONED],
			[Status.REVIEWING, Status.REJECTED],
		])("allows %s -> %s and audits exactly once", async (from, status) => {
			persisted.status = from;
			const before = { ...persisted };
			const result = await service.transition(actorId, reportId, {
				expectedStatus: from,
				status,
			});
			expect(result.status).toBe(status);
			expect(persisted).toEqual({ ...before, status });
			expect(reports.findForUpdate).toHaveBeenCalledWith(reportId);
			expect(transaction).toHaveBeenCalledTimes(1);
			expect(manager.withRepository).toHaveBeenCalledWith(reports);
			expect(auditSave).toHaveBeenCalledTimes(1);
			expect(auditSave).toHaveBeenCalledWith({
				actorId,
				action: "content_report.status_changed",
				targetType: "content_report",
				targetId: reportId,
				before: { status: from },
				after: { status },
				reason: null,
			});
			// Only safe reporter read and audit write; no target entity lookup/mutation.
			expect(getRepository.mock.calls.map(([entity]) => entity)).toEqual([AuditLog, User]);
		});
		const invalidPairs = Object.values(Status).flatMap((from) =>
			Object.values(Status)
				.filter(
					(to) =>
						(from !== Status.PENDING || to === Status.PENDING) &&
						!(from === Status.REVIEWING && [Status.ACTIONED, Status.REJECTED].includes(to))
				)
				.map((to) => [from, to] as const)
		);
		it.each(invalidPairs)("rejects %s -> %s without writes", async (from, to) => {
			persisted.status = from;
			await expect(
				service.transition(actorId, reportId, { expectedStatus: from, status: to })
			).rejects.toBeInstanceOf(ConflictException);
			expect(persisted.status).toBe(from);
			expect(reports.save).not.toHaveBeenCalled();
			expect(auditSave).not.toHaveBeenCalled();
		});
		it("rejects stale expected status before mutation", async () => {
			await expect(
				service.transition(actorId, reportId, {
					expectedStatus: Status.REVIEWING,
					status: Status.ACTIONED,
				})
			).rejects.toThrow("status has changed");
			expect(persisted.status).toBe(Status.PENDING);
			expect(reports.save).not.toHaveBeenCalled();
			expect(auditSave).not.toHaveBeenCalled();
		});
		it("returns 404 for a missing locked report", async () => {
			reports.findForUpdate.mockResolvedValueOnce(null);
			await expect(
				service.transition(actorId, reportId, {
					expectedStatus: Status.PENDING,
					status: Status.ACTIONED,
				})
			).rejects.toBeInstanceOf(NotFoundException);
			expect(auditSave).not.toHaveBeenCalled();
		});
		it.each([Status.ACTIONED, Status.REJECTED])(
			"rejects stale reviewing decision after %s",
			async (status) => {
				persisted.status = status;
				await expect(
					service.transition(actorId, reportId, {
						expectedStatus: Status.REVIEWING,
						status: Status.ACTIONED,
					})
				).rejects.toThrow("status has changed");
				expect(reports.save).not.toHaveBeenCalled();
				expect(auditSave).not.toHaveBeenCalled();
			}
		);
		it.each([
			[Status.PENDING, Status.ACTIONED],
			[Status.REVIEWING, Status.ACTIONED],
			[Status.REVIEWING, Status.REJECTED],
		])("rolls back %s -> %s on audit failure", async (from, status) => {
			persisted.status = from;
			auditSave.mockRejectedValueOnce(new Error("Audit unavailable"));
			await expect(
				service.transition(actorId, reportId, {
					expectedStatus: from,
					status,
				})
			).rejects.toThrow("Audit unavailable");
			expect(reports.save).toHaveBeenCalledTimes(1);
			expect(persisted.status).toBe(from);
			expect(reporterRead).not.toHaveBeenCalled();
		});
		it("rejects a non-admin before locking or writing", async () => {
			users.getGrantedRoles.mockReturnValue([UserRole.HOST]);
			await expect(
				service.transition(actorId, reportId, {
					expectedStatus: Status.PENDING,
					status: Status.ACTIONED,
				})
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(reports.findForUpdate).not.toHaveBeenCalled();
			expect(auditSave).not.toHaveBeenCalled();
		});
		it.each([null, { status: UserStatus.SUSPENDED }])(
			"rejects missing/inactive actor %p",
			async (actor) => {
				users.findOneWithRolesById.mockResolvedValueOnce(actor);
				await expect(
					service.transition(actorId, reportId, {
						expectedStatus: Status.PENDING,
						status: Status.ACTIONED,
					})
				).rejects.toBeInstanceOf(UnauthorizedException);
				expect(reports.findForUpdate).not.toHaveBeenCalled();
			}
		);
	});
});
