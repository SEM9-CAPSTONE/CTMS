import { ApiProperty } from "@nestjs/swagger";

export class CampsiteMediaUploadResponseDto {
	@ApiProperty({ example: "https://api.example.com/uploads/campsites/pending/cover.jpg" })
	url!: string;
}
