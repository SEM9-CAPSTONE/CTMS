import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { MAX_RESOLUTION_NOTE_LENGTH } from "../sos.constants";

export class CloseSosDto {
	@ApiProperty({
		description: "Resolution note describing how the emergency was resolved (CTMS-080, BR-261)",
		example: "Camper found and safely escorted back to base camp by rescue team",
		maxLength: MAX_RESOLUTION_NOTE_LENGTH,
	})
	@Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
	@IsNotEmpty({ message: "Resolution note is required" })
	@IsString({ message: "Resolution note must be a string" })
	@MaxLength(MAX_RESOLUTION_NOTE_LENGTH, {
		message: `Resolution note must not exceed ${MAX_RESOLUTION_NOTE_LENGTH} characters`,
	})
	resolutionNote!: string;
}
