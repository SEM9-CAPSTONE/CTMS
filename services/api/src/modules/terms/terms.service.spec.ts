import { ConflictException, NotFoundException } from "@nestjs/common";
import type { DataSource, EntityManager } from "typeorm";
import { QueryFailedError } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import { UserRole } from "../users/entities/user.entity";
import { TermsVersion } from "./entities/terms-version.entity";
import { UserTermsAcceptance } from "./entities/user-terms-acceptance.entity";
import {
	DEFAULT_TERMS_EFFECTIVE_DATE,
	DEFAULT_TERMS_SUMMARY,
	DEFAULT_TERMS_TITLE,
	DEFAULT_TERMS_V1_SECTIONS,
	DEFAULT_TERMS_VERSION,
} from "./terms-content";
import { TERMS_VERSION_OUTDATED_CODE } from "./terms-registration.helper";
import { TermsService } from "./terms.service";

function buildVersion(overrides: Partial<TermsVersion> = {}): TermsVersion {
	return {
		id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
		version: DEFAULT_TERMS_VERSION,
		title: DEFAULT_TERMS_TITLE,
		summary: DEFAULT_TERMS_SUMMARY,
		effectiveDate: DEFAULT_TERMS_EFFECTIVE_DATE,
		sections: DEFAULT_TERMS_V1_SECTIONS,
		isActive: true,
		requiresReconsent: true,
		publishedAt: new Date("2026-11-27T00:00:00.000Z"),
		createdAt: new Date("2026-11-27T00:00:00.000Z"),
		updatedAt: new Date("2026-11-27T00:00:00.000Z"),
		...overrides,
	};
}

describe("TermsService", () => {
	let termsRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; update: jest.Mock };
	let acceptanceRepo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
	let auditLogRepo: { save: jest.Mock };
	let dataSource: { getRepository: jest.Mock; transaction: jest.Mock };
	let service: TermsService;

	beforeEach(() => {
		termsRepo = {
			findOne: jest.fn(),
			find: jest.fn(),
			save: jest.fn(),
			update: jest.fn(),
		};
		acceptanceRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn() };
		auditLogRepo = { save: jest.fn() };

		const getRepository = jest.fn((entity: unknown) => {
			if (entity === TermsVersion) return termsRepo;
			if (entity === UserTermsAcceptance) return acceptanceRepo;
			if (entity === AuditLog) return auditLogRepo;
			return null;
		});

		const manager = { getRepository } as unknown as EntityManager;
		dataSource = {
			getRepository,
			transaction: jest.fn(async (cb: (m: EntityManager) => unknown) => cb(manager)),
		};

		service = new TermsService(dataSource as unknown as DataSource);
	});

	it("returns active terms version with all 12 sections", async () => {
		const active = buildVersion();
		termsRepo.findOne.mockResolvedValueOnce(active);

		const result = await service.getCurrentVersion();
		expect(result.version).toBe("1.0");
		expect(result.effectiveDate).toBe("2026-11-27");
		expect(result.sections).toHaveLength(12);
		expect(result.sections[0]?.number).toBe(1);
		expect(result.sections[11]?.number).toBe(12);
	});

	it("throws NotFoundException when no active terms version exists", async () => {
		termsRepo.findOne.mockResolvedValueOnce(null);
		await expect(service.getCurrentVersion()).rejects.toBeInstanceOf(NotFoundException);
	});

	it("lists all versions and allows looking up historical version by code", async () => {
		const v11 = buildVersion({ id: "v11", version: "1.1", isActive: true });
		const v10 = buildVersion({ id: "v10", version: "1.0", isActive: false });
		termsRepo.find.mockResolvedValueOnce([v11, v10]);
		termsRepo.findOne.mockResolvedValueOnce(v10);

		const list = await service.listVersions();
		expect(list.map((v) => v.version)).toEqual(["1.1", "1.0"]);

		const detail = await service.getVersionByCode("v1.0");
		expect(termsRepo.findOne).toHaveBeenCalledWith({ where: { version: "1.0" } });
		expect(detail.version).toBe("1.0");
		expect(detail.sections).toHaveLength(12);
	});

	it("returns needsReconsent = true when user has no acceptance or accepted an older version", async () => {
		const v11 = buildVersion({ id: "v11-id", version: "1.1", requiresReconsent: true });
		termsRepo.findOne.mockResolvedValueOnce(v11);
		acceptanceRepo.find.mockResolvedValueOnce([
			{
				id: "acc-1",
				userId: "user-1",
				termsVersionId: "v10-id",
				version: "1.0",
				acceptedAt: new Date("2026-11-01T10:00:00.000Z"),
				source: "registration",
				platform: "web",
			},
		]);

		const status = await service.getMyStatus("user-1");
		expect(status.currentVersion).toBe("1.1");
		expect(status.acceptedCurrentVersion).toBe(false);
		expect(status.needsReconsent).toBe(true);
		expect(status.latestAcceptance?.version).toBe("1.0");
		expect(status.acceptanceHistory).toHaveLength(1);
	});

	it("returns needsReconsent = false once user accepted active version (syncs Web & Mobile)", async () => {
		const v11 = buildVersion({ id: "v11-id", version: "1.1", requiresReconsent: true });
		termsRepo.findOne.mockResolvedValueOnce(v11);
		acceptanceRepo.find.mockResolvedValueOnce([
			{
				id: "acc-2",
				userId: "user-1",
				termsVersionId: "v11-id",
				version: "1.1",
				acceptedAt: new Date("2026-11-28T08:00:00.000Z"),
				source: "reconsent",
				platform: "mobile",
			},
			{
				id: "acc-1",
				userId: "user-1",
				termsVersionId: "v10-id",
				version: "1.0",
				acceptedAt: new Date("2026-11-01T10:00:00.000Z"),
				source: "registration",
				platform: "web",
			},
		]);

		const status = await service.getMyStatus("user-1");
		expect(status.acceptedCurrentVersion).toBe(true);
		expect(status.needsReconsent).toBe(false);
		expect(status.acceptanceHistory).toHaveLength(2);
	});

	it("accepts current version, writes audit log, and handles repeat/idempotent submissions", async () => {
		const active = buildVersion({ id: "v10-id", version: "1.0" });
		termsRepo.findOne.mockResolvedValue(active);
		acceptanceRepo.findOne.mockResolvedValueOnce(null);
		const savedDate = new Date("2026-11-27T09:00:00.000Z");
		acceptanceRepo.save.mockResolvedValueOnce({
			id: "acc-new",
			userId: "user-1",
			termsVersionId: "v10-id",
			version: "1.0",
			acceptedAt: savedDate,
			source: "reconsent",
			platform: "web",
		});

		const first = await service.acceptTerms("user-1", { version: "v1.0", platform: "web" });
		expect(first.accepted).toBe(true);
		expect(first.alreadyAccepted).toBe(false);
		expect(first.version).toBe("1.0");
		expect(auditLogRepo.save).toHaveBeenCalledTimes(1);

		// Repeat call is idempotent
		acceptanceRepo.findOne.mockResolvedValueOnce({
			id: "acc-new",
			userId: "user-1",
			termsVersionId: "v10-id",
			version: "1.0",
			acceptedAt: savedDate,
			source: "reconsent",
			platform: "web",
		});
		const second = await service.acceptTerms("user-1", { version: "1.0", platform: "mobile" });
		expect(second.accepted).toBe(true);
		expect(second.alreadyAccepted).toBe(true);
		expect(second.acceptedAt).toBe(savedDate.toISOString());
	});

	it("rejects acceptance with 409 TERMS_VERSION_OUTDATED when version changed while reading", async () => {
		const active = buildVersion({ id: "v11-id", version: "1.1", effectiveDate: "2026-12-01" });
		termsRepo.findOne.mockResolvedValueOnce(active);

		let caught: unknown;
		try {
			await service.acceptTerms("user-1", { version: "1.0", platform: "web" });
		} catch (err) {
			caught = err;
		}
		expect(caught).toBeInstanceOf(ConflictException);
		const response = (caught as ConflictException).getResponse() as Record<string, unknown>;
		expect(response.code).toBe(TERMS_VERSION_OUTDATED_CODE);
		expect(response.currentVersion).toBe("1.1");
	});

	it("handles concurrent unique violation idempotently", async () => {
		const active = buildVersion({ id: "v10-id", version: "1.0" });
		const savedDate = new Date("2026-11-27T09:15:00.000Z");
		termsRepo.findOne.mockResolvedValueOnce(active);
		acceptanceRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
			id: "acc-race",
			userId: "user-1",
			termsVersionId: "v10-id",
			version: "1.0",
			acceptedAt: savedDate,
			source: "reconsent",
			platform: "web",
		});
		const driverError = Object.assign(new Error("duplicate key"), { code: "23505" });
		acceptanceRepo.save.mockRejectedValueOnce(new QueryFailedError("INSERT", [], driverError));

		const result = await service.acceptTerms("user-1", { version: "1.0", platform: "web" });
		expect(result.accepted).toBe(true);
		expect(result.alreadyAccepted).toBe(true);
	});

	it("never requires re-consent for Admin accounts", async () => {
		const active = buildVersion({ id: "v10-id", version: "1.0", requiresReconsent: true });
		termsRepo.findOne.mockResolvedValueOnce(active);
		acceptanceRepo.find.mockResolvedValueOnce([]);

		const status = await service.getMyStatus("admin-1", [UserRole.ADMIN]);
		expect(status.needsReconsent).toBe(false);
		expect(status.acceptedCurrentVersion).toBe(false);
	});

	it("allows Admin to publish a new active version and deactivates previous active version", async () => {
		const prev = buildVersion({ id: "v10-id", version: "1.0", isActive: true });
		termsRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(prev);
		termsRepo.save.mockImplementationOnce(async (payload: Partial<TermsVersion>) =>
			buildVersion({
				...payload,
				id: "v11-id",
				version: "1.1",
				isActive: true,
			})
		);

		const created = await service.publishNewVersion("admin-1", {
			version: "v1.1",
			title: DEFAULT_TERMS_TITLE,
			summary: "Cập nhật chính sách mới",
			effectiveDate: "2026-12-01",
			sections: DEFAULT_TERMS_V1_SECTIONS,
			requiresReconsent: true,
		});

		expect(termsRepo.update).toHaveBeenCalledWith({ id: "v10-id" }, { isActive: false });
		expect(created.version).toBe("1.1");
		expect(created.isActive).toBe(true);
		expect(auditLogRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ action: "terms.version_published" })
		);
	});

	it("allows Admin to edit an existing version and records audit log", async () => {
		const existing = buildVersion({ id: "v10-id", version: "1.0" });
		termsRepo.findOne.mockResolvedValueOnce(existing);
		termsRepo.save.mockImplementationOnce(async (entity: TermsVersion) => entity);

		const updated = await service.updateVersion("admin-1", "v10-id", {
			title: "Điều khoản và Chính sách sử dụng CTMS (Cập nhật)",
			requiresReconsent: false,
		});

		expect(updated.title).toBe("Điều khoản và Chính sách sử dụng CTMS (Cập nhật)");
		expect(updated.requiresReconsent).toBe(false);
		expect(auditLogRepo.save).toHaveBeenCalledWith(
			expect.objectContaining({ action: "terms.version_updated" })
		);
	});
});
