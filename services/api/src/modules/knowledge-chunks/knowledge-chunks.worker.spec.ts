import { ConfigService } from "@nestjs/config";
import type { SurvivalSourceReader } from "../survival-documents/survival-source-reader.service";
import type { KnowledgeChunksProvider } from "./knowledge-chunks.provider";
import type { KnowledgeChunksRepository } from "./knowledge-chunks.repository";
import { chunkConfiguration } from "./knowledge-chunks.types";
import { KnowledgeChunksWorker } from "./knowledge-chunks.worker";

describe("Knowledge queue service readiness", () => {
	function fixture(available: boolean) {
		const repository = {
			consumeEvents: jest.fn().mockResolvedValue(undefined),
			reconcile: jest.fn().mockResolvedValue({ candidates: 0, lastDocumentId: null }),
			hasRecoverableFailures: jest.fn().mockResolvedValue(true),
			recoverFailed: jest.fn().mockResolvedValue(undefined),
			claim: jest.fn().mockResolvedValue(null),
			cleanupHistory: jest.fn().mockResolvedValue({ deleted: 0, retainedByDependency: 0 }),
		};
		const provider = {
			configuration: () => chunkConfiguration(),
			isAvailable: jest.fn().mockResolvedValue(available),
		};
		const worker = new KnowledgeChunksWorker(
			repository as unknown as KnowledgeChunksRepository,
			provider as unknown as KnowledgeChunksProvider,
			{} as SurvivalSourceReader,
			new ConfigService()
		);
		return { worker, repository, provider };
	}

	it("keeps queued work pending without claiming attempts while ingestion is unavailable or outdated", async () => {
		const { worker, repository, provider } = fixture(false);
		await worker.tick();
		expect(repository.consumeEvents).toHaveBeenCalledWith(chunkConfiguration());
		expect(repository.reconcile).toHaveBeenCalled();
		expect(repository.claim).not.toHaveBeenCalled();
		expect(repository.recoverFailed).not.toHaveBeenCalled();
		provider.isAvailable.mockResolvedValue(true);
		await worker.tick();
		expect(repository.claim).toHaveBeenCalledTimes(1);
	});

	it("recovers due failures and claims work once the matching authenticated service is ready", async () => {
		const { worker, repository } = fixture(true);
		await worker.tick();
		expect(repository.recoverFailed).toHaveBeenCalledWith(chunkConfiguration());
		expect(repository.claim).toHaveBeenCalledWith(chunkConfiguration());
	});
});
