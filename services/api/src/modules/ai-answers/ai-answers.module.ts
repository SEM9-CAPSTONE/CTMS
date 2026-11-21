import { Module } from "@nestjs/common";
import { AiInvestigationModule } from "../ai-investigations/ai-investigation.module";
import { AuthModule } from "../auth/auth.module";
import { RagModule } from "../rag/rag.module";
import { AiAnswersController } from "./ai-answers.controller";
import { AiAnswersRepository } from "./ai-answers.repository";
import { AiAnswersService } from "./ai-answers.service";
import { AiFeedbackService } from "./ai-feedback.service";
import { AiGenerationProvider } from "./ai-generation.provider";

@Module({
	imports: [AuthModule, RagModule, AiInvestigationModule],
	controllers: [AiAnswersController],
	providers: [AiAnswersService, AiAnswersRepository, AiGenerationProvider, AiFeedbackService],
})
export class AiAnswersModule {}
