import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
	IsEnum,
	IsNotEmpty,
	IsOptional,
	IsString,
	MaxLength,
	Validate,
	type ValidationArguments,
	ValidatorConstraint,
	type ValidatorConstraintInterface,
} from "class-validator";
import {
	PorterCertificateStatus,
	PorterCertificateType,
} from "../entities/porter-certificate.entity";

@ValidatorConstraint({ name: "isFutureOrTodayDate", async: false })
export class IsFutureOrTodayDateConstraint implements ValidatorConstraintInterface {
	validate(value: string | undefined): boolean {
		if (!value) return true;
		const today = new Date().toISOString().split("T")[0];
		return value >= today;
	}

	defaultMessage(_args: ValidationArguments): string {
		return "Ngày hết hạn không được ở trong quá khứ";
	}
}

export class CreatePorterCertificateDto {
	@ApiProperty({
		enum: PorterCertificateType,
		description: "Loại chứng chỉ (wfa, rescue, guide_card, other)",
	})
	@IsEnum(PorterCertificateType, { message: "Loại chứng chỉ không hợp lệ" })
	type!: PorterCertificateType;

	@ApiProperty({
		description: "Tên hiển thị chứng chỉ",
		example: "Chứng chỉ Sơ cấp cứu dã ngoại (WFA)",
	})
	@IsString({ message: "Tên chứng chỉ phải là chuỗi" })
	@IsNotEmpty({ message: "Tên chứng chỉ không được để trống" })
	@MaxLength(255, { message: "Tên chứng chỉ tối đa 255 ký tự" })
	name!: string;

	@ApiPropertyOptional({ description: "Số hiệu chứng chỉ", example: "WFA-2026-0891" })
	@IsOptional()
	@IsString()
	@MaxLength(100, { message: "Số hiệu chứng chỉ tối đa 100 ký tự" })
	certificateNumber?: string;

	@ApiPropertyOptional({ description: "Đơn vị cấp", example: "Hiệp hội Cứu hộ & Chữ thập đỏ" })
	@IsOptional()
	@IsString()
	@MaxLength(255, { message: "Đơn vị cấp tối đa 255 ký tự" })
	issuedBy?: string;

	@ApiPropertyOptional({ description: "Ngày cấp (YYYY-MM-DD)", example: "2026-01-15" })
	@IsOptional()
	@IsString()
	issuedDate?: string;

	@ApiPropertyOptional({ description: "Ngày hết hạn (YYYY-MM-DD)", example: "2027-01-15" })
	@IsOptional()
	@IsString()
	@Validate(IsFutureOrTodayDateConstraint)
	expiryDate?: string;

	@ApiPropertyOptional({ description: "Đường dẫn ảnh chứng chỉ" })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	fileUrl?: string;
}

export class UpdatePorterCertificateDto {
	@ApiPropertyOptional({ enum: PorterCertificateType })
	@IsOptional()
	@IsEnum(PorterCertificateType)
	type?: PorterCertificateType;

	@ApiPropertyOptional({ description: "Tên hiển thị chứng chỉ" })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	@MaxLength(255)
	name?: string;

	@ApiPropertyOptional({ description: "Số hiệu chứng chỉ" })
	@IsOptional()
	@IsString()
	@MaxLength(100)
	certificateNumber?: string;

	@ApiPropertyOptional({ description: "Đơn vị cấp" })
	@IsOptional()
	@IsString()
	@MaxLength(255)
	issuedBy?: string;

	@ApiPropertyOptional({ description: "Ngày cấp (YYYY-MM-DD)" })
	@IsOptional()
	@IsString()
	issuedDate?: string;

	@ApiPropertyOptional({ description: "Ngày hết hạn (YYYY-MM-DD)" })
	@IsOptional()
	@IsString()
	expiryDate?: string;

	@ApiPropertyOptional({ description: "Đường dẫn ảnh chứng chỉ" })
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	fileUrl?: string;
}

export class AdminRejectCertificateDto {
	@ApiProperty({
		description: "Lý do từ chối xét duyệt",
		example: "Ảnh chụp chứng chỉ bị mờ, không thể đối chiếu số hiệu",
	})
	@IsString({ message: "Lý do từ chối phải là chuỗi" })
	@IsNotEmpty({ message: "Vui lòng nhập lý do từ chối" })
	@MaxLength(1000, { message: "Lý do từ chối tối đa 1000 ký tự" })
	rejectionReason!: string;
}

export class PorterCertificateResponseDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid" })
	porterId!: string;

	@ApiProperty({ enum: PorterCertificateType })
	type!: PorterCertificateType;

	@ApiProperty()
	name!: string;

	@ApiPropertyOptional()
	certificateNumber!: string | null;

	@ApiPropertyOptional()
	issuedBy!: string | null;

	@ApiPropertyOptional()
	issuedDate!: string | null;

	@ApiPropertyOptional()
	expiryDate!: string | null;

	@ApiPropertyOptional()
	fileUrl!: string | null;

	@ApiProperty({ enum: PorterCertificateStatus })
	status!: PorterCertificateStatus;

	@ApiPropertyOptional()
	rejectionReason!: string | null;

	@ApiPropertyOptional()
	verifiedBy!: string | null;

	@ApiPropertyOptional()
	verifiedAt!: Date | null;

	@ApiProperty({ description: "Trạng thái hết hạn tính động lúc đọc dữ liệu" })
	isExpired!: boolean;

	@ApiProperty()
	createdAt!: Date;

	@ApiProperty()
	updatedAt!: Date;
}

/**
 * DTO dành riêng cho Host khi tìm kiếm Porter.
 * TUYỆT ĐỐI KHÔNG trả fileUrl, certificateNumber, issuedBy hoặc rejectionReason.
 */
export class AvailablePorterCertificateDto {
	@ApiProperty({ enum: PorterCertificateType })
	type!: PorterCertificateType;

	@ApiProperty({ description: "Tên chứng chỉ" })
	name!: string;
}
