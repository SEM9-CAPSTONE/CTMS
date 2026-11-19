import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import {
	PorterCertificate,
	PorterCertificateStatus,
	PorterCertificateType,
} from "../entities/porter-certificate.entity";
import type { PorterCertificatesRepository } from "../repositories/porter-certificates.repository";
import { PorterCertificatesService } from "./porter-certificates.service";

const PORTER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PORTER_ID = "99999999-9999-9999-9999-999999999999";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";
const CERT_ID = "33333333-3333-3333-3333-333333333333";

function mockCert(overrides: Partial<PorterCertificate> = {}): PorterCertificate {
	const cert = new PorterCertificate();
	Object.assign(
		cert,
		{
			id: CERT_ID,
			porterId: PORTER_ID,
			type: PorterCertificateType.WFA,
			name: "Sơ cấp cứu hoang dã WFA",
			certificateNumber: "WFA-2025-01",
			issuedBy: "Viện Cứu hộ Việt Nam",
			issuedDate: "2025-01-01",
			expiryDate: "2027-01-01",
			fileUrl: "/uploads/certificates/cert.png",
			status: PorterCertificateStatus.PENDING,
			rejectionReason: null,
			verifiedBy: null,
			verifiedAt: null,
			createdAt: new Date(),
			updatedAt: new Date(),
			deletedAt: null,
		},
		overrides
	);
	return cert;
}

describe("PorterCertificatesService", () => {
	let service: PorterCertificatesService;
	let repository: jest.Mocked<Partial<PorterCertificatesRepository>>;

	beforeEach(() => {
		repository = {
			findActiveById: jest.fn(),
			findActiveByPorterId: jest.fn(),
			findDuplicate: jest.fn(),
			create: jest.fn().mockImplementation((val) => Object.assign(new PorterCertificate(), val)),
			save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
			findAllForAdmin: jest.fn(),
		};
		service = new PorterCertificatesService(repository as PorterCertificatesRepository);
	});

	describe("create", () => {
		it("creates a certificate with pending status", async () => {
			(repository.findDuplicate as jest.Mock).mockResolvedValue(null);

			const result = await service.create(PORTER_ID, {
				type: PorterCertificateType.WFA,
				name: "Sơ cấp cứu hoang dã WFA",
				certificateNumber: "WFA-2025-01",
				issuedBy: "Viện Cứu hộ Việt Nam",
				expiryDate: "2027-01-01",
				fileUrl: "/uploads/certificates/cert.png",
			});

			expect(result.status).toBe(PorterCertificateStatus.PENDING);
			expect(result.porterId).toBe(PORTER_ID);
			expect(repository.save).toHaveBeenCalled();
		});

		it("throws ConflictException when duplicate type and certificate number exists", async () => {
			(repository.findDuplicate as jest.Mock).mockResolvedValue(mockCert());

			await expect(
				service.create(PORTER_ID, {
					type: PorterCertificateType.WFA,
					name: "Sơ cấp cứu hoang dã WFA",
					certificateNumber: "WFA-2025-01",
					issuedBy: "Viện Cứu hộ Việt Nam",
					expiryDate: "2027-01-01",
					fileUrl: "/uploads/certificates/cert.png",
				})
			).rejects.toThrow(ConflictException);
		});
	});

	describe("update", () => {
		it("resets verified certificate to pending when fileUrl or expiryDate changes", async () => {
			const existing = mockCert({
				status: PorterCertificateStatus.VERIFIED,
				verifiedBy: ADMIN_ID,
				verifiedAt: new Date(),
			});
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const updated = await service.update(PORTER_ID, CERT_ID, {
				expiryDate: "2028-01-01",
			});

			expect(updated.status).toBe(PorterCertificateStatus.PENDING);
			expect(updated.verifiedBy).toBeNull();
			expect(updated.verifiedAt).toBeNull();
		});

		it("allows updating rejected certificate back to pending", async () => {
			const existing = mockCert({
				status: PorterCertificateStatus.REJECTED,
				rejectionReason: "Ảnh mờ",
			});
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const updated = await service.update(PORTER_ID, CERT_ID, {
				fileUrl: "/uploads/certificates/new-clear-photo.png",
			});

			expect(updated.status).toBe(PorterCertificateStatus.PENDING);
			expect(updated.rejectionReason).toBeNull();
		});

		it("preserves original certificate type when updating without specifying a new type", async () => {
			const existing = mockCert({
				type: PorterCertificateType.RESCUE,
				name: "Kỹ thuật cứu hộ đường sông",
			});
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const updated = await service.update(PORTER_ID, CERT_ID, {
				name: "Kỹ thuật cứu hộ đường sông nâng cao",
			});

			// Must strictly retain RESCUE, not fall back to WFA
			expect(updated.type).toBe(PorterCertificateType.RESCUE);
			expect(updated.name).toBe("Kỹ thuật cứu hộ đường sông nâng cao");
		});

		it("throws ForbiddenException when another porter attempts to update certificate", async () => {
			const existing = mockCert({ porterId: PORTER_ID });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			await expect(
				service.update(OTHER_PORTER_ID, CERT_ID, {
					name: "Hacking attempt",
				})
			).rejects.toThrow(ForbiddenException);
		});
	});

	describe("access control and getCertificateDetail", () => {
		it("allows the owner to view certificate detail", async () => {
			const existing = mockCert({ porterId: PORTER_ID });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const result = await service.getCertificateDetail(PORTER_ID, false, CERT_ID);
			expect(result.id).toBe(CERT_ID);
			expect(result.name).toBe(existing.name);
		});

		it("allows an admin to view any porter certificate detail", async () => {
			const existing = mockCert({ porterId: PORTER_ID });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const result = await service.getCertificateDetail(ADMIN_ID, true, CERT_ID);
			expect(result.id).toBe(CERT_ID);
		});

		it("throws ForbiddenException when another porter tries to view certificate detail", async () => {
			const existing = mockCert({ porterId: PORTER_ID });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			await expect(service.getCertificateDetail(OTHER_PORTER_ID, false, CERT_ID)).rejects.toThrow(
				ForbiddenException
			);
		});
	});

	describe("soft delete", () => {
		it("marks certificate as deleted", async () => {
			const existing = mockCert();
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const result = await service.delete(PORTER_ID, CERT_ID);
			expect(result).toEqual({ success: true, message: "Đã xóa chứng chỉ thành công" });
			expect(existing.deletedAt).toBeDefined();
			expect(repository.save).toHaveBeenCalledWith(existing);
		});

		it("throws ForbiddenException when another porter attempts to delete", async () => {
			const existing = mockCert({ porterId: PORTER_ID });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			await expect(service.delete(OTHER_PORTER_ID, CERT_ID)).rejects.toThrow(ForbiddenException);
		});
	});

	describe("admin actions", () => {
		it("verifies pending certificate", async () => {
			const existing = mockCert({ status: PorterCertificateStatus.PENDING });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const result = await service.adminVerify(ADMIN_ID, CERT_ID);
			expect(result.status).toBe(PorterCertificateStatus.VERIFIED);
			expect(result.verifiedBy).toBe(ADMIN_ID);
			expect(result.verifiedAt).toBeDefined();
			expect(result.rejectionReason).toBeNull();
		});

		it("rejects pending certificate with mandatory reason", async () => {
			const existing = mockCert({ status: PorterCertificateStatus.PENDING });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			const reason = "Ảnh chụp bị mờ không đọc được số hiệu.";
			const result = await service.adminReject(ADMIN_ID, CERT_ID, {
				rejectionReason: reason,
			});

			expect(result.status).toBe(PorterCertificateStatus.REJECTED);
			expect(result.rejectionReason).toBe(reason);
			expect(result.verifiedBy).toBe(ADMIN_ID);
		});

		it("throws BadRequestException when rejection reason is empty", async () => {
			const existing = mockCert({ status: PorterCertificateStatus.PENDING });
			(repository.findActiveById as jest.Mock).mockResolvedValue(existing);

			await expect(
				service.adminReject(ADMIN_ID, CERT_ID, {
					rejectionReason: "   ",
				})
			).rejects.toThrow(BadRequestException);
		});
	});
});
