import { IsInt, Min } from "class-validator";

export class StartDocumentEditDto {
	@IsInt() @Min(1) expectedDocumentRevision!: number;
}
