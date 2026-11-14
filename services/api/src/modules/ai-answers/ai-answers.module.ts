import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RagModule } from "../rag/rag.module";
import { AiAnswersController } from "./ai-answers.controller";
import { AiAnswersRepository } from "./ai-answers.repository";
import { AiAnswersService } from "./ai-answers.service";
import { AiGenerationProvider } from "./ai-generation.provider";

@Module({
	imports: [AuthModule, RagModule],
	controllers: [AiAnswersController],
	providers: [AiAnswersService, AiAnswersRepository, AiGenerationProvider],
})
export class AiAnswersModule {}
