import { ApiProperty } from "@nestjs/swagger";

export class GeoAreaResponseDto {
	@ApiProperty({ example: "DNG-SON-TRA" })
	code!: string;

	@ApiProperty({ example: "Sơn Trà" })
	name!: string;

	@ApiProperty({ example: "DNG" })
	provinceCode!: string;

	@ApiProperty({ example: "Đà Nẵng" })
	provinceName!: string;
}
