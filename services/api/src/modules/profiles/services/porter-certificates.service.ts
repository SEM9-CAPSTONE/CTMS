import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	AdminRejectCertificateDto,
	CreatePorterCertificateDto,
	PorterCertificateResponseDto,
	UpdatePorterCertificateDto,
} from "../dto/porter-certificate.dto";
import {
	type PorterCertificate,
	PorterCertificateStatus,
} from "../entities/porter-certificate.entity";
// biome-ignore lint/style/useImportType: NestJS DI needs runtime metadata
import {
	AdminCertificateRow,
	PorterCertificatesRepository,
} from "../repositories/porter-certificates.repository";

@Injectable()
export class PorterCertificatesService {
	constructor(private readonly porterCertificatesRepository: PorterCertificatesRepository) {}

	private toResponseDto(certificate: PorterCertificate): PorterCertificateResponseDto {
		return {
			id: certificate.id,
			porterId: certificate.porterId,
			type: certificate.type,
			name: certificate.name,
			certificateNumber: certificate.certificateNumber ?? null,
			issuedBy: certificate.issuedBy ?? null,
			issuedDate: certificate.issuedDate ?? null,
			expiryDate: certificate.expiryDate ?? null,
			fileUrl: certificate.fileUrl ?? null,
			status: certificate.status,
			rejectionReason: certificate.rejectionReason ?? null,
			verifiedBy: certificate.verifiedBy ?? null,
			verifiedAt: certificate.verifiedAt ?? null,
			isExpired: certificate.isExpired,
			createdAt: certificate.createdAt,
			updatedAt: certificate.updatedAt,
		};
	}

	async getMyCertificates(porterId: string): Promise<PorterCertificateResponseDto[]> {
		const items = await this.porterCertificatesRepository.findActiveByPorterId(porterId);
		return items.map((item) => this.toResponseDto(item));
	}

	async getCertificateDetail(
		userId: string,
		isAdmin: boolean,
		id: string
	): Promise<PorterCertificateResponseDto> {
		const certificate = await this.porterCertificatesRepository.findActiveById(id);
		if (!certificate) {
			throw new NotFoundException("Không tìm thấy chứng chỉ");
		}

		if (!isAdmin && certificate.porterId !== userId) {
			throw new ForbiddenException("Bạn không có quyền truy cập chứng chỉ này");
		}

		return this.toResponseDto(certificate);
	}

	async create(
		porterId: string,
		dto: CreatePorterCertificateDto
	): Promise<PorterCertificateResponseDto> {
		if (dto.certificateNumber) {
			const duplicate = await this.porterCertificatesRepository.findDuplicate(
				porterId,
				dto.type,
				dto.certificateNumber
			);
			if (duplicate) {
				throw new ConflictException("Chứng chỉ với số hiệu này đã tồn tại trong hồ sơ của bạn");
			}
		}

		const today = new Date().toISOString().split("T")[0];
		if (dto.expiryDate && dto.expiryDate < today) {
			throw new BadRequestException("Ngày hết hạn không được ở trong quá khứ khi tạo mới");
		}

		const entity = this.porterCertificatesRepository.create({
			porterId,
			type: dto.type,
			name: dto.name.trim(),
			certificateNumber: dto.certificateNumber?.trim() || null,
			issuedBy: dto.issuedBy?.trim() || null,
			issuedDate: dto.issuedDate || null,
			expiryDate: dto.expiryDate || null,
			fileUrl: dto.fileUrl || null,
			status: PorterCertificateStatus.PENDING,
			rejectionReason: null,
			verifiedBy: null,
			verifiedAt: null,
		});

		const saved = await this.porterCertificatesRepository.save(entity);
		return this.toResponseDto(saved);
	}

	async update(
		porterId: string,
		id: string,
		dto: UpdatePorterCertificateDto
	): Promise<PorterCertificateResponseDto> {
		const certificate = await this.porterCertificatesRepository.findActiveById(id);
		if (!certificate) {
			throw new NotFoundException("Không tìm thấy chứng chỉ");
		}

		if (certificate.porterId !== porterId) {
			throw new ForbiddenException("Bạn không có quyền chỉnh sửa chứng chỉ này");
		}

		const nextType = dto.type ?? certificate.type;
		const nextNumber =
			dto.certificateNumber !== undefined ? dto.certificateNumber : certificate.certificateNumber;

		if (nextNumber) {
			const duplicate = await this.porterCertificatesRepository.findDuplicate(
				porterId,
				nextType,
				nextNumber,
				id
			);
			if (duplicate) {
				throw new ConflictException("Chứng chỉ với số hiệu này đã tồn tại trong hồ sơ của bạn");
			}
		}

		const fileUrlChanged = dto.fileUrl !== undefined && dto.fileUrl !== certificate.fileUrl;
		const expiryDateChanged =
			dto.expiryDate !== undefined && dto.expiryDate !== certificate.expiryDate;

		// Business rule: Sửa ảnh hoặc ngày hết hạn của chứng chỉ đã xác minh -> tự động quay về pending
		if (
			certificate.status === PorterCertificateStatus.VERIFIED &&
			(fileUrlChanged || expiryDateChanged)
		) {
			certificate.status = PorterCertificateStatus.PENDING;
			certificate.verifiedBy = null;
			certificate.verifiedAt = null;
			certificate.rejectionReason = null;
		}

		// Business rule: Bị từ chối thì Porter gửi lại được -> quay về pending
		if (certificate.status === PorterCertificateStatus.REJECTED) {
			certificate.status = PorterCertificateStatus.PENDING;
			certificate.rejectionReason = null;
		}

		if (dto.type !== undefined) certificate.type = dto.type;
		if (dto.name !== undefined) certificate.name = dto.name.trim();
		if (dto.certificateNumber !== undefined)
			certificate.certificateNumber = dto.certificateNumber?.trim() || null;
		if (dto.issuedBy !== undefined) certificate.issuedBy = dto.issuedBy?.trim() || null;
		if (dto.issuedDate !== undefined) certificate.issuedDate = dto.issuedDate || null;
		if (dto.expiryDate !== undefined) certificate.expiryDate = dto.expiryDate || null;
		if (dto.fileUrl !== undefined) certificate.fileUrl = dto.fileUrl || null;

		const saved = await this.porterCertificatesRepository.save(certificate);
		return this.toResponseDto(saved);
	}

	async delete(porterId: string, id: string): Promise<{ success: boolean; message: string }> {
		const certificate = await this.porterCertificatesRepository.findActiveById(id);
		if (!certificate) {
			throw new NotFoundException("Không tìm thấy chứng chỉ");
		}

		if (certificate.porterId !== porterId) {
			throw new ForbiddenException("Bạn không có quyền xóa chứng chỉ này");
		}

		// Business rule: Xóa mềm để lưu vết audit
		certificate.deletedAt = new Date();
		await this.porterCertificatesRepository.save(certificate);

		return {
			success: true,
			message: "Đã xóa chứng chỉ thành công",
		};
	}

	// ==================== ADMIN ACTIONS ====================

	async listForAdmin(status?: PorterCertificateStatus | "expired"): Promise<AdminCertificateRow[]> {
		return this.porterCertificatesRepository.findAllForAdmin(status);
	}

	async adminVerify(adminId: string, id: string): Promise<PorterCertificateResponseDto> {
		const certificate = await this.porterCertificatesRepository.findActiveById(id);
		if (!certificate) {
			throw new NotFoundException("Không tìm thấy chứng chỉ");
		}

		certificate.status = PorterCertificateStatus.VERIFIED;
		certificate.verifiedBy = adminId;
		certificate.verifiedAt = new Date();
		certificate.rejectionReason = null;

		const saved = await this.porterCertificatesRepository.save(certificate);
		return this.toResponseDto(saved);
	}

	async adminReject(
		adminId: string,
		id: string,
		dto: AdminRejectCertificateDto
	): Promise<PorterCertificateResponseDto> {
		const certificate = await this.porterCertificatesRepository.findActiveById(id);
		if (!certificate) {
			throw new NotFoundException("Không tìm thấy chứng chỉ");
		}

		if (!dto.rejectionReason || !dto.rejectionReason.trim()) {
			throw new BadRequestException("Vui lòng cung cấp lý do từ chối");
		}

		certificate.status = PorterCertificateStatus.REJECTED;
		certificate.verifiedBy = adminId;
		certificate.verifiedAt = new Date();
		certificate.rejectionReason = dto.rejectionReason.trim();

		const saved = await this.porterCertificatesRepository.save(certificate);
		return this.toResponseDto(saved);
	}
}
