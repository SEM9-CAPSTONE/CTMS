import type { DataSource, EntityManager } from "typeorm";
import type { UploadsService } from "../../uploads/uploads.service";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import type { PorterVerificationDocument } from "../entities/porter-verification-document.entity";
import {
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";
import type { PorterVerificationDocumentsRepository } from "../repositories/porter-verification-documents.repository";
import type { PorterVerificationsRepository } from "../repositories/porter-verifications.repository";
import {
	MAX_PORTER_VERIFICATION_DOCUMENTS,
	PorterVerificationsService,
} from "./porter-verifications.service";

const PORTER_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-10-17T10:00:00.000Z");

function verification(overrides: Partial<PorterVerification> = {}): PorterVerification {
	return {
		porterId: PORTER_ID,
		status: PorterVerificationStatus.PENDING_DOCUMENTS,
		submittedAt: null,
		reviewedBy: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 1,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	} as PorterVerification;
}

function document(): PorterVerificationDocument {
	return {
		id: "33333333-3333-3333-3333-333333333333",
		porterId: PORTER_ID,
		fileUrl: "https://files.test/doc.pdf",
		fileKey: "doc",
		originalName: "doc.pdf",
		mimeType: "application/pdf",
		sizeBytes: 100,
		uploadedAt: NOW,
	} as PorterVerificationDocument;
}

const activePorter = {
	id: PORTER_ID,
	status: UserStatus.ACTIVE,
	role: UserRole.PORTER,
	roleAssignments: [{ role: UserRole.PORTER }],
};

function setup(current: PorterVerification | null, documents: PorterVerificationDocument[] = []) {
	const verifications = {
		findByPorterId: jest.fn().mockResolvedValue(current),
		findByPorterIdForUpdate: jest.fn().mockResolvedValue(current),
		ensureExists: jest.fn(),
		save: jest.fn(async (value: PorterVerification) => value),
		findContact: jest.fn().mockResolvedValue({
			porterId: PORTER_ID,
			fullName: "Porter",
			email: "porter@example.com",
			phone: null,
			experienceYears: 3,
			certifications: [],
		}),
	};
	const docs = {
		findByPorterId: jest.fn().mockResolvedValue(documents),
		countByPorterId: jest.fn().mockResolvedValue(documents.length),
		create: jest.fn((value: Partial<PorterVerificationDocument>) => value),
		save: jest.fn(async (value: Partial<PorterVerificationDocument>) => ({
			...document(),
			...value,
		})),
	};
	const users = {
		findOneWithRolesById: jest.fn().mockResolvedValue(activePorter),
		findOneWithRolesByIdForUpdate: jest.fn().mockResolvedValue(activePorter),
		getGrantedRoles: jest.fn().mockReturnValue([UserRole.PORTER]),
	};
	const uploads = {
		uploadDocument: jest.fn().mockResolvedValue({ url: "https://files.test/new.pdf", key: "k" }),
	};
	const audit = { save: jest.fn() };
	const verificationsToken = {} as PorterVerificationsRepository;
	const documentsToken = {} as PorterVerificationDocumentsRepository;
	const usersToken = {} as UsersRepository;
	Object.assign(verificationsToken, verifications);
	Object.assign(documentsToken, docs);
	Object.assign(usersToken, users);
	const manager = {
		withRepository: jest.fn((repository) => repository),
		getRepository: jest.fn().mockReturnValue(audit),
		query: jest.fn().mockResolvedValue([{ now: NOW }]),
	};
	const dataSource = {
		transaction: jest.fn((callback: (entityManager: EntityManager) => unknown) =>
			callback(manager as unknown as EntityManager)
		),
	};
	const service = new PorterVerificationsService(
		verificationsToken,
		documentsToken,
		usersToken,
		uploads as unknown as UploadsService,
		dataSource as unknown as DataSource
	);
	return { service, verifications, docs, uploads, audit };
}

const pdf = {
	originalname: "certificate.pdf",
	mimetype: "application/pdf",
	size: 100,
	buffer: Buffer.from("%PDF-1.7"),
} as Express.Multer.File;

describe("PorterVerificationsService", () => {
	it("returns pending_documents with version 0 when no record exists", async () => {
		const { service } = setup(null);

		await expect(service.getMine(PORTER_ID)).resolves.toMatchObject({
			status: PorterVerificationStatus.PENDING_DOCUMENTS,
			version: 0,
			documents: [],
		});
	});

	it("uploads a document through UploadsService and records it", async () => {
		const { service, uploads, verifications, docs } = setup(null);

		const result = await service.uploadDocument(PORTER_ID, pdf);

		expect(uploads.uploadDocument).toHaveBeenCalledWith(pdf, "porter-verifications");
		expect(verifications.ensureExists).toHaveBeenCalledWith(PORTER_ID);
		expect(docs.save).toHaveBeenCalled();
		expect(result.fileUrl).toBe("https://files.test/new.pdf");
	});

	it("does not upload while the verification is pending review", async () => {
		const { service, uploads } = setup(
			verification({ status: PorterVerificationStatus.PENDING_REVIEW })
		);

		await expect(service.uploadDocument(PORTER_ID, pdf)).rejects.toMatchObject({ status: 409 });
		expect(uploads.uploadDocument).not.toHaveBeenCalled();
	});

	it("does not upload beyond the document limit", async () => {
		const full = Array.from({ length: MAX_PORTER_VERIFICATION_DOCUMENTS }, document);
		const { service, uploads } = setup(verification(), full);

		await expect(service.uploadDocument(PORTER_ID, pdf)).rejects.toMatchObject({ status: 409 });
		expect(uploads.uploadDocument).not.toHaveBeenCalled();
	});

	it("requires at least one document to submit", async () => {
		const { service } = setup(verification(), []);

		await expect(service.submit(PORTER_ID)).rejects.toMatchObject({ status: 422 });
	});

	it("submits for review, clears a previous rejection and audits", async () => {
		const { service, audit } = setup(
			verification({
				status: PorterVerificationStatus.REJECTED,
				reviewedBy: ADMIN_ID,
				reviewedAt: NOW,
				rejectionReason: "Blurry",
			}),
			[document()]
		);

		const result = await service.submit(PORTER_ID);

		expect(result).toMatchObject({
			status: PorterVerificationStatus.PENDING_REVIEW,
			rejectionReason: null,
			reviewedAt: null,
			version: 2,
		});
		expect(audit.save).toHaveBeenCalledWith(
			expect.objectContaining({ action: "porter_verification.submitted" })
		);
	});

	it("approves only verifications pending review", async () => {
		const { service } = setup(verification({ status: PorterVerificationStatus.APPROVED }));

		await expect(service.approve(ADMIN_ID, PORTER_ID)).rejects.toMatchObject({ status: 409 });
	});

	it("rejects with a reason and records the reviewer", async () => {
		const pending = verification({ status: PorterVerificationStatus.PENDING_REVIEW });
		const { service, verifications, audit } = setup(pending, [document()]);

		await service.reject(ADMIN_ID, PORTER_ID, { reason: "Certificate expired" });

		expect(verifications.save).toHaveBeenCalledWith(
			expect.objectContaining({
				status: PorterVerificationStatus.REJECTED,
				reviewedBy: ADMIN_ID,
				rejectionReason: "Certificate expired",
			})
		);
		expect(audit.save).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "porter_verification.rejected",
				reason: "Certificate expired",
			})
		);
	});
});
