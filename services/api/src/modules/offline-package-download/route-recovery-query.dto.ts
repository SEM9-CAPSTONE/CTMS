import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsInt, IsUUID, Max, Min } from "class-validator";

export class RouteRecoveryQueryDto {
	@ApiProperty({
		format: "uuid",
		description: "Exact package UUID selected locally; not a server activation claim",
	})
	@IsUUID()
	@Transform(({ value }: { value: unknown }) =>
		typeof value === "string" ? value.toLowerCase() : value
	)
	packageId!: string;

	@ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 })
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(2147483647)
	packageVersion!: number;
}
