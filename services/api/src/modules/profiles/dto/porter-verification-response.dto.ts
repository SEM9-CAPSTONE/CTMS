import { ApiProperty } from "@nestjs/swagger";
import { IsDateString, IsIn, Matches } from "class-validator";
import type { PorterVerificationDocument } from "../entities/porter-verification-document.entity";
import {
	GuideCardType,
	type PorterVerification,
	PorterVerificationStatus,
} from "../entities/porter-verification.entity";

/** The tour-guide card the Porter declares (bug-list item #4). */
export class GuideCardDto {
	@ApiProperty({
		enum: GuideCardType,
		description: "Domestic or international; site-only cards are not accepted",
	})
	@IsIn(Object.values(GuideCardType), {
		message: "Chỉ nhận thẻ hướng dẫn viên nội địa hoặc quốc tế",
	})
	cardType!: GuideCardType;

	@ApiProperty({ example: "123456789", description: "9 digits as printed on the card" })
	@Matches(/^\d{9}$/, { message: "Số thẻ hướng dẫn viên gồm đúng 9 chữ số" })
	cardNumber!: string;

	@ApiProperty({ example: "2030-01-01", description: "Valid through this date (YYYY-MM-DD)" })
	@IsDateString({ strict: true }, { message: "Ngày hết hạn không hợp lệ" })
	@Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "Ngày hết hạn phải có dạng YYYY-MM-DD" })
	expiresOn!: string;
}

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

	@ApiProperty({
		type: GuideCardDto,
		nullable: true,
		description: "Null until the Porter declares a card",
	})
	guideCard!: GuideCardDto | null;

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
		guideCard: toGuideCardDto(verification),
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
		guideCard: null,
		documents: [],
	};
}

function toGuideCardDto(verification: PorterVerification): GuideCardDto | null {
	if (
		!verification.guideCardType ||
		!verification.guideCardNumber ||
		!verification.guideCardExpiresOn
	) {
		return null;
	}
	return {
		cardType: verification.guideCardType,
		cardNumber: verification.guideCardNumber,
		expiresOn: verification.guideCardExpiresOn,
	};
}
