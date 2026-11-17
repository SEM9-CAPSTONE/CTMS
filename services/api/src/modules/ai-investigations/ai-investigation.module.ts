import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RagModule } from "../rag/rag.module";
import { AiInvestigationAdminService } from "./ai-investigation-admin.service";
import { AiInvestigationAnalyzer } from "./ai-investigation-analyzer";
import { AiInvestigationEvidence } from "./ai-investigation-evidence";
import { AiInvestigationWorker } from "./ai-investigation-worker";
import { AiInvestigationController } from "./ai-investigation.controller";

@Module({
	imports: [AuthModule, RagModule],
	controllers: [AiInvestigationController],
	providers: [
		AiInvestigationAdminService,
		AiInvestigationAnalyzer,
		AiInvestigationEvidence,
		AiInvestigationWorker,
	],
})
export class AiInvestigationModule {}
