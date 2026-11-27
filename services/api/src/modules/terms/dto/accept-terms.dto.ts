import { Transform } from "class-transformer";
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { type TermsPlatform, normalizeTermsVersion } from "../terms-content";

export class AcceptTermsDto {
	@Transform(({ value }) => (typeof value === "string" ? normalizeTermsVersion(value) : value))
	@IsString({ message: "Phiên bản điều khoản phải là chuỗi hợp lệ." })
	@IsNotEmpty({ message: "Phiên bản điều khoản là bắt buộc." })
	@MaxLength(32, { message: "Mã phiên bản điều khoản không hợp lệ." })
	version!: string;

	@IsOptional()
	@IsIn(["web", "mobile", "api"], { message: "Nền tảng không hợp lệ." })
	platform?: TermsPlatform;
}
