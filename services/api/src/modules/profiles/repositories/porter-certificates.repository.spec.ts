import type { DataSource } from "typeorm";
import {
	PorterCertificateStatus,
	PorterCertificateType,
} from "../entities/porter-certificate.entity";
import { PorterCertificatesRepository } from "./porter-certificates.repository";

describe("PorterCertificatesRepository", () => {
	let repository: PorterCertificatesRepository;
	let mockDataSource: jest.Mocked<Partial<DataSource>>;

	const PORTER_1 = "p1-1111-1111-1111-111111111111";
	const PORTER_2 = "p2-2222-2222-2222-222222222222";
	const PORTER_3 = "p3-3333-3333-3333-333333333333";

	let mockQuery: jest.Mock;

	beforeEach(() => {
		mockQuery = jest.fn();
		const mockManager = {
			query: mockQuery,
		};
		mockDataSource = {
			createEntityManager: jest.fn().mockReturnValue(mockManager),
			query: mockQuery,
		};
		repository = new PorterCertificatesRepository(mockDataSource as unknown as DataSource);
		jest.spyOn(repository, "query").mockImplementation(mockQuery);
	});

	describe("findVerifiedNonExpiredByPorterIds (Host View integration)", () => {
		it("performs exactly 1 single SQL query for multiple porters (O(1) query count, prevents N+1)", async () => {
			mockQuery.mockResolvedValue([
				{ porterId: PORTER_1, type: "wfa", name: "Sơ cấp cứu WFA" },
				{ porterId: PORTER_2, type: "rescue", name: "Cứu hộ đường sông" },
			]);

			const porterIds = [PORTER_1, PORTER_2, PORTER_3];
			const resultMap = await repository.findVerifiedNonExpiredByPorterIds(porterIds);

			// Assert exactly ONE query was executed
			expect(mockQuery).toHaveBeenCalledTimes(1);

			// Map should initialize keys for all requested porters
			expect(resultMap.has(PORTER_1)).toBe(true);
			expect(resultMap.has(PORTER_2)).toBe(true);
			expect(resultMap.has(PORTER_3)).toBe(true);
			expect(resultMap.get(PORTER_3)).toEqual([]);
		});

		it("returns strictly only verified and non-expired certificates; excludes pending, rejected and expired", async () => {
			// Mocking SQL query return that enforces WHERE status = 'verified' AND expiry_date >= CURRENT_DATE
			mockQuery.mockImplementation((sql: string) => {
				expect(sql).toContain("c.status = 'verified'");
				expect(sql).toContain("c.expiry_date >= CURRENT_DATE");
				expect(sql).toContain("c.deleted_at IS NULL");

				return Promise.resolve([
					{
						porterId: PORTER_1,
						type: PorterCertificateType.WFA,
						name: "Sơ cấp cứu WFA",
					},
				]);
			});

			const resultMap = await repository.findVerifiedNonExpiredByPorterIds([PORTER_1]);
			const certs = resultMap.get(PORTER_1) || [];

			expect(certs).toHaveLength(1);
			expect(certs[0].type).toBe(PorterCertificateType.WFA);
			expect(certs[0].name).toBe("Sơ cấp cứu WFA");
		});

		it("ensures response for Host contains ONLY type and name; NO fileUrl, certificateNumber, or issuedBy", async () => {
			mockQuery.mockResolvedValue([
				{
					porterId: PORTER_1,
					type: PorterCertificateType.GUIDE_CARD,
					name: "Thẻ Hướng dẫn viên du lịch",
				},
			]);

			const resultMap = await repository.findVerifiedNonExpiredByPorterIds([PORTER_1]);
			const cert = resultMap.get(PORTER_1)?.[0];

			expect(cert).toBeDefined();
			if (!cert) throw new Error("Certificate must be defined");
			expect(Object.keys(cert)).toEqual(["type", "name"]);
			// Strict privacy checks:
			expect((cert as unknown as Record<string, unknown>).fileUrl).toBeUndefined();
			expect((cert as unknown as Record<string, unknown>).certificateNumber).toBeUndefined();
			expect((cert as unknown as Record<string, unknown>).issuedBy).toBeUndefined();
			expect((cert as unknown as Record<string, unknown>).rejectionReason).toBeUndefined();
		});

		it("returns empty map when input array is empty without running any DB query", async () => {
			const resultMap = await repository.findVerifiedNonExpiredByPorterIds([]);
			expect(resultMap.size).toBe(0);
			expect(mockQuery).not.toHaveBeenCalled();
		});
	});

	describe("findAllForAdmin filtering", () => {
		it("applies expiry date filter when status is 'expired'", async () => {
			mockQuery.mockImplementation((sql: string) => {
				expect(sql).toContain("c.expiry_date < CURRENT_DATE");
				return Promise.resolve([]);
			});

			await repository.findAllForAdmin("expired");
			expect(mockQuery).toHaveBeenCalled();
		});

		it("applies status filter when status is pending or verified", async () => {
			mockQuery.mockImplementation((sql: string, params: unknown[]) => {
				expect(sql).toContain("c.status = $1");
				expect(params).toEqual([PorterCertificateStatus.PENDING]);
				return Promise.resolve([]);
			});

			await repository.findAllForAdmin(PorterCertificateStatus.PENDING);
			expect(mockQuery).toHaveBeenCalled();
		});
	});
});
