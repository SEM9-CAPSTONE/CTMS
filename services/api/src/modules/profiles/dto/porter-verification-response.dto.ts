import { ApiProperty } from "@nestjs/swagger";
import type { PorterVerificationDocument } from "../entities/porter-verification-document.entity";
import {
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";

export class PorterVerificationDocumentDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty()
	fileUrl!: string;

	@ApiProperty()
	originalName!: string;

	@ApiProperty({ example: "application/pdf" })
	mimeType!: string;

	@ApiProperty()
	sizeBytes!: number;

	@ApiProperty()
	uploadedAt!: Date;
}

export class PorterVerificationResponseDto {
	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ enum: PorterVerificationStatus })
	status!: PorterVerificationStatus;

	@ApiProperty({ type: Date, nullable: true })
	submittedAt!: Date | null;

	@ApiProperty({ type: Date, nullable: true })
	reviewedAt!: Date | null;

	@ApiProperty({ type: String, nullable: true })
	rejectionReason!: string | null;

	@ApiProperty({ description: "0 when no verification record exists yet" })
	version!: number;

	@ApiProperty({ type: [PorterVerificationDocumentDto] })
	documents!: PorterVerificationDocumentDto[];
}

export function toPorterVerificationDocumentDto(
	document: PorterVerificationDocument
): PorterVerificationDocumentDto {
	return {
		id: document.id,
		fileUrl: document.fileUrl,
		originalName: document.originalName,
		mimeType: document.mimeType,
		sizeBytes: document.sizeBytes,
		uploadedAt: document.uploadedAt,
	};
}

export function toPorterVerificationResponse(
	verification: PorterVerification,
	documents: PorterVerificationDocument[]
): PorterVerificationResponseDto {
	return {
		porterId: verification.porterId,
		status: verification.status,
		submittedAt: verification.submittedAt,
		reviewedAt: verification.reviewedAt,
		rejectionReason: verification.rejectionReason,
		version: verification.version,
		documents: documents.map(toPorterVerificationDocumentDto),
	};
}

export function defaultPorterVerificationResponse(porterId: string): PorterVerificationResponseDto {
	return {
		porterId,
		status: PorterVerificationStatus.PENDING_DOCUMENTS,
		submittedAt: null,
		reviewedAt: null,
		rejectionReason: null,
		version: 0,
		documents: [],
	};
}
