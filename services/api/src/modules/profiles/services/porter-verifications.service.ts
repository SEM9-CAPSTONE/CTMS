import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { UploadsService } from "../../uploads/uploads.service";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { UsersRepository } from "../../users/users.repository";
import type {
	AdminPorterVerificationDetailDto,
	ListPorterVerificationsQueryDto,
	PaginatedPorterVerificationsResponseDto,
	RejectPorterVerificationDto,
} from "../dto/admin-porter-verification.dto";
import {
	type PorterVerificationDocumentDto,
	type PorterVerificationResponseDto,
	defaultPorterVerificationResponse,
	toPorterVerificationDocumentDto,
	toPorterVerificationResponse,
} from "../dto/porter-verification-response.dto";
import {
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterVerificationDocumentsRepository } from "../repositories/porter-verification-documents.repository";
// biome-ignore lint/style/useImportType: constructor-injected by NestJS DI, needs runtime metadata
import { PorterVerificationsRepository } from "../repositories/porter-verifications.repository";

export const MAX_PORTER_VERIFICATION_DOCUMENTS = 5;
export const PORTER_VERIFICATION_UPLOAD_FOLDER = "porter-verifications";

const ACTIVE_PORTER_REQUIRED = "An active Porter account is required";
const DOCUMENTS_LOCKED = "Verification documents cannot be changed in the current status";
const DOCUMENT_LIMIT = `A maximum of ${MAX_PORTER_VERIFICATION_DOCUMENTS} documents can be uploaded`;
const DOCUMENT_REQUIRED = "At least one guide certificate document is required";
const NOT_SUBMITTABLE =
	"Verification can only be submitted while documents are pending or rejected";
const NOT_REVIEWABLE = "Only verifications pending review can be approved or rejected";

const EDITABLE_STATUSES = new Set([
	PorterVerificationStatus.PENDING_DOCUMENTS,
	PorterVerificationStatus.REJECTED,
]);

@Injectable()
export class PorterVerificationsService {
	constructor(
		private readonly verificationsRepository: PorterVerificationsRepository,
		private readonly documentsRepository: PorterVerificationDocumentsRepository,
		private readonly usersRepository: UsersRepository,
		private readonly uploadsService: UploadsService,
		private readonly dataSource: DataSource
	) {}

	async getMine(porterId: string): Promise<PorterVerificationResponseDto> {
		await this.requireActivePorter(porterId, this.usersRepository);
		const verification = await this.verificationsRepository.findByPorterId(porterId);
		if (!verification) return defaultPorterVerificationResponse(porterId);
		const documents = await this.documentsRepository.findByPorterId(porterId);
		return toPorterVerificationResponse(verification, documents);
	}

	async isApproved(porterId: string): Promise<boolean> {
		return this.verificationsRepository.isApproved(porterId);
	}

	async uploadDocument(
		porterId: string,
		file?: Express.Multer.File
	): Promise<PorterVerificationDocumentDto> {
		if (!file) throw new BadRequestException("Vui lòng chọn file tài liệu");
		await this.requireActivePorter(porterId, this.usersRepository);

		// Cheap pre-check so a locked or full profile does not waste a storage upload;
		// the authoritative check is repeated under lock below.
		const current = await this.verificationsRepository.findByPorterId(porterId);
		this.assertEditable(current);
		if (
			(await this.documentsRepository.countByPorterId(porterId)) >=
			MAX_PORTER_VERIFICATION_DOCUMENTS
		) {
			throw new ConflictException(DOCUMENT_LIMIT);
		}

		const stored = await this.uploadsService.uploadDocument(
			file,
			PORTER_VERIFICATION_UPLOAD_FOLDER
		);

		return this.dataSource.transaction(async (manager) => {
			const verifications = manager.withRepository(this.verificationsRepository);
			const documents = manager.withRepository(this.documentsRepository);
			await verifications.ensureExists(porterId);
			const verification = await verifications.findByPorterIdForUpdate(porterId);
			this.assertEditable(verification);
			if ((await documents.countByPorterId(porterId)) >= MAX_PORTER_VERIFICATION_DOCUMENTS) {
				throw new ConflictException(DOCUMENT_LIMIT);
			}

			const saved = await documents.save(
				documents.create({
					porterId,
					fileUrl: stored.url,
					fileKey: stored.key ?? null,
					originalName: sanitizeFileName(file.originalname),
					mimeType: file.mimetype,
					sizeBytes: file.size,
				})
			);
			return toPorterVerificationDocumentDto(saved);
		});
	}

	async deleteDocument(porterId: string, documentId: string): Promise<void> {
		await this.requireActivePorter(porterId, this.usersRepository);
		await this.dataSource.transaction(async (manager) => {
			const verification = await manager
				.withRepository(this.verificationsRepository)
				.findByPorterIdForUpdate(porterId);
			const documents = manager.withRepository(this.documentsRepository);
			const document = verification ? await documents.findOneForPorter(porterId, documentId) : null;
			if (!document) throw new NotFoundException("Verification document not found");
			this.assertEditable(verification);
			await documents.delete({ id: document.id });
		});
	}

	async submit(porterId: string): Promise<PorterVerificationResponseDto> {
		return this.dataSource.transaction(async (manager) => {
			await this.requireActivePorter(porterId, manager.withRepository(this.usersRepository), true);
			const verifications = manager.withRepository(this.verificationsRepository);
			const documents = manager.withRepository(this.documentsRepository);
			const verification = await verifications.findByPorterIdForUpdate(porterId);
			if (verification && !EDITABLE_STATUSES.has(verification.status)) {
				throw new ConflictException(NOT_SUBMITTABLE);
			}
			const files = verification ? await documents.findByPorterId(porterId) : [];
			if (!verification || files.length === 0) {
				throw new UnprocessableEntityException(DOCUMENT_REQUIRED);
			}

			const before = snapshot(verification);
			verification.status = PorterVerificationStatus.PENDING_REVIEW;
			verification.submittedAt = await databaseNow(manager);
			verification.reviewedBy = null;
			verification.reviewedAt = null;
			verification.rejectionReason = null;
			verification.version += 1;
			const saved = await verifications.save(verification);
			await writeAudit(manager, {
				actorId: porterId,
				action: "porter_verification.submitted",
				porterId,
				before,
				after: { ...snapshot(saved), documentCount: files.length },
				reason: null,
			});
			return toPorterVerificationResponse(saved, files);
		});
	}

	async listForAdmin(
		query: ListPorterVerificationsQueryDto
	): Promise<PaginatedPorterVerificationsResponseDto> {
		const { items, total } = await this.verificationsRepository.listForAdmin({
			status: query.status,
			search: query.search,
			page: query.page,
			limit: query.limit,
		});
		return {
			items,
			pagination: {
				page: query.page,
				limit: query.limit,
				total,
				totalPages: Math.ceil(total / query.limit),
			},
		};
	}

	async getForAdmin(porterId: string): Promise<AdminPorterVerificationDetailDto> {
		const contact = await this.verificationsRepository.findContact(porterId);
		if (!contact) throw new NotFoundException("Porter not found");
		const verification = await this.verificationsRepository.findByPorterId(porterId);
		const documents = verification ? await this.documentsRepository.findByPorterId(porterId) : [];
		const base = verification
			? toPorterVerificationResponse(verification, documents)
			: defaultPorterVerificationResponse(porterId);
		return {
			...base,
			fullName: contact.fullName,
			email: contact.email,
			phone: contact.phone,
			reviewedBy: verification?.reviewedBy ?? null,
			experienceYears: contact.experienceYears,
			certifications: contact.certifications,
		};
	}

	async approve(adminId: string, porterId: string): Promise<AdminPorterVerificationDetailDto> {
		await this.review(adminId, porterId, PorterVerificationStatus.APPROVED, null);
		return this.getForAdmin(porterId);
	}

	async reject(
		adminId: string,
		porterId: string,
		dto: RejectPorterVerificationDto
	): Promise<AdminPorterVerificationDetailDto> {
		await this.review(adminId, porterId, PorterVerificationStatus.REJECTED, dto.reason);
		return this.getForAdmin(porterId);
	}

	private async review(
		adminId: string,
		porterId: string,
		status: PorterVerificationStatus.APPROVED | PorterVerificationStatus.REJECTED,
		reason: string | null
	): Promise<void> {
		await this.dataSource.transaction(async (manager) => {
			const verifications = manager.withRepository(this.verificationsRepository);
			const verification = await verifications.findByPorterIdForUpdate(porterId);
			if (!verification) throw new NotFoundException("Porter verification not found");
			if (verification.status !== PorterVerificationStatus.PENDING_REVIEW) {
				throw new ConflictException(NOT_REVIEWABLE);
			}

			const before = snapshot(verification);
			verification.status = status;
			verification.reviewedBy = adminId;
			verification.reviewedAt = await databaseNow(manager);
			verification.rejectionReason = reason;
			verification.version += 1;
			const saved = await verifications.save(verification);
			await writeAudit(manager, {
				actorId: adminId,
				action:
					status === PorterVerificationStatus.APPROVED
						? "porter_verification.approved"
						: "porter_verification.rejected",
				porterId,
				before,
				after: snapshot(saved),
				reason,
			});
		});
	}

	private assertEditable(verification: PorterVerification | null): void {
		if (verification && !EDITABLE_STATUSES.has(verification.status)) {
			throw new ConflictException(DOCUMENTS_LOCKED);
		}
	}

	private async requireActivePorter(
		porterId: string,
		repository: UsersRepository,
		lock = false
	): Promise<void> {
		const user = lock
			? await repository.findOneWithRolesByIdForUpdate(porterId)
			: await repository.findOneWithRolesById(porterId);
		if (
			!user ||
			user.status !== UserStatus.ACTIVE ||
			!repository.getGrantedRoles(user).includes(UserRole.PORTER)
		) {
			throw new ForbiddenException(ACTIVE_PORTER_REQUIRED);
		}
	}
}

function snapshot(verification: PorterVerification): Record<string, unknown> {
	return {
		status: verification.status,
		submittedAt: verification.submittedAt,
		reviewedBy: verification.reviewedBy,
		reviewedAt: verification.reviewedAt,
		rejectionReason: verification.rejectionReason,
		version: verification.version,
	};
}

async function writeAudit(
	manager: EntityManager,
	input: {
		actorId: string;
		action: string;
		porterId: string;
		before: Record<string, unknown>;
		after: Record<string, unknown>;
		reason: string | null;
	}
): Promise<void> {
	await manager.getRepository(AuditLog).save({
		actorId: input.actorId,
		action: input.action,
		targetType: "porter_verification",
		targetId: input.porterId,
		before: input.before,
		after: input.after,
		// audit_logs.reason is varchar(255); the full reason stays in `after`.
		reason: input.reason ? input.reason.slice(0, 255) : null,
	});
}

async function databaseNow(manager: EntityManager): Promise<Date> {
	const rows = (await manager.query(`SELECT clock_timestamp() AS "now"`)) as Array<{ now: Date }>;
	return new Date(rows[0].now);
}

function sanitizeFileName(name: string): string {
	// Multer decodes multipart filenames as latin1; recover UTF-8 names (e.g. Vietnamese).
	const decoded = Buffer.from(name, "latin1").toString("utf8");
	const base = (decoded.includes("�") ? name : decoded).split(/[\\/]/).pop() ?? "document";
	const cleaned = [...base]
		.filter((char) => {
			const code = char.charCodeAt(0);
			return code >= 0x20 && code !== 0x7f;
		})
		.join("")
		.trim();
	return (cleaned || "document").slice(0, 255);
}
