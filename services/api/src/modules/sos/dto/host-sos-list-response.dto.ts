import { ApiProperty } from "@nestjs/swagger";
import { SosAlertResponseDto } from "./sos-alert-response.dto";

export class HostSosListResponseDto {
	@ApiProperty({ type: [SosAlertResponseDto] })
	items!: SosAlertResponseDto[];

	@ApiProperty({ example: 4 })
	total!: number;

	@ApiProperty({ example: 1 })
	page!: number;

	@ApiProperty({ example: 10 })
	limit!: number;
}
