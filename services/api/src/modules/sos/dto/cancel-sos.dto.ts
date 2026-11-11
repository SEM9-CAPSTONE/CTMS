import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { MAX_CANCELLATION_REASON_LENGTH } from "../sos.constants";

export class CancelSosDto {
	@ApiProperty({
		description: "Reason why the SOS alert was sent by mistake",
		example: "Accidentally pressed while hiking, false alarm",
		maxLength: MAX_CANCELLATION_REASON_LENGTH,
	})
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsNotEmpty({ message: "Cancellation reason is required" })
	@IsString({ message: "Cancellation reason must be a string" })
	@MaxLength(MAX_CANCELLATION_REASON_LENGTH, {
		message: `Cancellation reason must not exceed ${MAX_CANCELLATION_REASON_LENGTH} characters`,
	})
	reason!: string;
}
