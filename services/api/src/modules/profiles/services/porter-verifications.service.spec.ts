import type { DataSource, EntityManager } from "typeorm";
import type { UploadsService } from "../../uploads/uploads.service";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { UsersRepository } from "../../users/users.repository";
import type {
	GuideCardExtraction,
	PorterVerificationDocument,
} from "../entities/porter-verification-document.entity";
import {
	GuideCardType,
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";
import type { GuideCardExtractionProvider } from "../providers/guide-card-extraction.provider";
import type { PorterVerificationDocumentsRepository } from "../repositories/porter-verification-documents.repository";
import type { PorterVerificationsRepository } from "../repositories/porter-verifications.repository";
import {
	MAX_PORTER_VERIFICATION_DOCUMENTS,
	PorterVerificationsService,
} from "./porter-verifications.service";

const PORTER_ID = "11111111-1111-1111-1111-111111111111";
const ADMIN_ID = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-10-17T10:00:00.000Z");

/** A declared, still valid domestic card (expiry far in the future). */
const CARD = {
	guideCardType: GuideCardType.DOMESTIC,
	guideCardNumber: "123456789",
	guideCardExpiresOn: "2099-01-01",
};

function reading(overrides: Partial<Extract<GuideCardExtraction, { status: "read" }>> = {}) {
	return {
		status: "read",
		isGuideCard: true,
		fullName: "Nguyễn Văn Porter",
		cardNumber: "123456789",
		cardType: "noi_dia",
		expiresOn: "2099-01-01",
		confidence: 0.9,
		model: "test",
		...overrides,
	} as GuideCardExtraction;
}

function verification(overrides: Partial<PorterVerification> = {}): PorterVerification {
	return {
		porterId: PORTER_ID,
		status: PorterVerificationStatus.PENDING_DOCUMENTS,
		submittedAt: null,
		reviewedBy: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 1,
		guideCardType: null,
		guideCardNumber: null,
		guideCardExpiresOn: null,
		cardCheck: null,
		cardCheckedAt: null,
		registryCheckedBy: null,
		registryCheckedAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	} as PorterVerification;
}

function document(extraction: GuideCardExtraction | null = null): PorterVerificationDocument {
	return {
		extraction,
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
	fullName: "Nguyễn Văn Porter",
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
	const cardReader = { extract: jest.fn().mockResolvedValue(reading()) };
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
		dataSource as unknown as DataSource,
		cardReader as unknown as GuideCardExtractionProvider
	);
	return { service, verifications, docs, uploads, audit, cardReader };
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

	it("uploads a document through UploadsService, reads it and records the reading", async () => {
		const { service, uploads, verifications, docs, cardReader } = setup(null);

		const result = await service.uploadDocument(PORTER_ID, pdf);

		expect(uploads.uploadDocument).toHaveBeenCalledWith(pdf, "porter-verifications");
		expect(cardReader.extract).toHaveBeenCalledWith(pdf.buffer, "application/pdf");
		expect(verifications.ensureExists).toHaveBeenCalledWith(PORTER_ID);
		expect(docs.create).toHaveBeenCalledWith(expect.objectContaining({ extraction: reading() }));
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

	it("submits for review, clears a previous rejection, stores the card check and audits", async () => {
		const { service, audit, verifications } = setup(
			verification({
				...CARD,
				status: PorterVerificationStatus.REJECTED,
				reviewedBy: ADMIN_ID,
				reviewedAt: NOW,
				rejectionReason: "Blurry",
			}),
			[document(reading())]
		);

		const result = await service.submit(PORTER_ID);

		expect(result).toMatchObject({
			status: PorterVerificationStatus.PENDING_REVIEW,
			rejectionReason: null,
			reviewedAt: null,
			version: 2,
			guideCard: { cardType: "noi_dia", cardNumber: "123456789", expiresOn: "2099-01-01" },
		});
		expect(verifications.save).toHaveBeenCalledWith(
			expect.objectContaining({
				cardCheck: expect.objectContaining({ labels: [], autoRejected: false }),
				registryCheckedBy: null,
			})
		);
		expect(audit.save).toHaveBeenCalledWith(
			expect.objectContaining({ action: "porter_verification.submitted" })
		);
	});

	it("requires a declared, unexpired guide card to submit", async () => {
		await expect(
			setup(verification(), [document()]).service.submit(PORTER_ID)
		).rejects.toMatchObject({
			status: 422,
		});
		const expired = setup(verification({ ...CARD, guideCardExpiresOn: "2000-01-01" }), [
			document(),
		]);
		await expect(expired.service.submit(PORTER_ID)).rejects.toMatchObject({ status: 422 });
	});

	it.each([
		["expired on the photo", reading({ expiresOn: "2000-01-01" }), "đã hết hạn"],
		["a site-only card", reading({ cardType: "tai_diem" }), "tại điểm"],
	])(
		"auto-rejects %s with a reason for the Porter and a system audit",
		async (_label, extraction, text) => {
			const { service, audit } = setup(verification(CARD), [document(extraction)]);

			const result = await service.submit(PORTER_ID);

			expect(result.status).toBe(PorterVerificationStatus.REJECTED);
			expect(result.rejectionReason).toContain(text);
			expect(audit.save).toHaveBeenCalledWith(
				expect.objectContaining({ action: "porter_verification.auto_rejected", actorId: null })
			);
		}
	);

	it("labels mismatches but leaves the decision to the Admin", async () => {
		const { service, verifications } = setup(verification(CARD), [
			document(reading({ fullName: "Trần Văn Khác", cardNumber: "999999999" })),
		]);

		const result = await service.submit(PORTER_ID);

		expect(result.status).toBe(PorterVerificationStatus.PENDING_REVIEW);
		expect(verifications.save).toHaveBeenCalledWith(
			expect.objectContaining({
				cardCheck: expect.objectContaining({ labels: ["NAME_MISMATCH", "NUMBER_MISMATCH"] }),
			})
		);
	});

	it("declares the guide card only while documents are editable and refuses an expired one", async () => {
		const editable = setup(verification());
		await expect(
			editable.service.updateGuideCard(PORTER_ID, {
				cardType: GuideCardType.INTERNATIONAL,
				cardNumber: "123456789",
				expiresOn: "2099-01-01",
			})
		).resolves.toMatchObject({ guideCard: { cardType: "quoc_te" } });

		const locked = setup(verification({ status: PorterVerificationStatus.PENDING_REVIEW }));
		await expect(
			locked.service.updateGuideCard(PORTER_ID, {
				cardType: GuideCardType.DOMESTIC,
				cardNumber: "123456789",
				expiresOn: "2099-01-01",
			})
		).rejects.toMatchObject({ status: 409 });
		await expect(
			editable.service.updateGuideCard(PORTER_ID, {
				cardType: GuideCardType.DOMESTIC,
				cardNumber: "123456789",
				expiresOn: "2000-01-01",
			})
		).rejects.toMatchObject({ status: 422 });
	});

	it("approves only verifications pending review", async () => {
		const { service } = setup(verification({ status: PorterVerificationStatus.APPROVED }));

		await expect(
			service.approve(ADMIN_ID, PORTER_ID, { officialRegistryChecked: true })
		).rejects.toMatchObject({ status: 409 });
	});

	it("approves only after the official registry check and records who checked", async () => {
		const pending = verification({ ...CARD, status: PorterVerificationStatus.PENDING_REVIEW });
		const { service, verifications } = setup(pending, [document()]);

		await expect(
			service.approve(ADMIN_ID, PORTER_ID, { officialRegistryChecked: false })
		).rejects.toMatchObject({ status: 422 });
		await service.approve(ADMIN_ID, PORTER_ID, { officialRegistryChecked: true });
		expect(verifications.save).toHaveBeenCalledWith(
			expect.objectContaining({
				status: PorterVerificationStatus.APPROVED,
				registryCheckedBy: ADMIN_ID,
				registryCheckedAt: NOW,
			})
		);
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
