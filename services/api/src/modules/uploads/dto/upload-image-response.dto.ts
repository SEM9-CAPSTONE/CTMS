import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UploadImageResponseDto {
	@ApiProperty({
		description: "URL công khai của ảnh đã tải lên",
		example: "https://res.cloudinary.com/ctms/image/upload/v1234567890/ctms/sample.jpg",
	})
	url!: string;

	@ApiPropertyOptional({
		description: "Mã định danh của ảnh trên cloud storage",
		example: "ctms/sample",
	})
	key?: string;
}
