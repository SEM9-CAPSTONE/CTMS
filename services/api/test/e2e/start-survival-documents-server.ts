import setupIntegrationDatabase from "../setup-integration-database";
import "../setup-survival-source-policy";

const database = process.env.TEST_DATABASE_URL ?? "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";
if (!new URL(database).pathname.endsWith("_test"))
	throw new Error("CTMS50 browser tests require an isolated _test database");
Object.assign(process.env, {
	DATABASE_URL: database,
	TEST_DATABASE_URL: database,
	NODE_ENV: "test",
	JWT_SECRET: "ctms50-browser-test-secret",
	TRIP_STATUS_WORKER_ENABLED: "false",
	BOOKING_EXPIRY_WORKER_ENABLED: "false",
	TRIP_AUTO_CANCEL_WORKER_ENABLED: "false",
	PORTER_REQUEST_EXPIRY_WORKER_ENABLED: "false",
});
async function start() {
	await setupIntegrationDatabase();
	const { createSurvivalE2eApp } = require("../support/survival-e2e-app") as typeof import(
		"../support/survival-e2e-app"
	);
	const { app } = await createSurvivalE2eApp();
	// Browser tests use the production queue/worker/publication transaction with
	// deterministic parser output. Real PDF parsing is covered by the Python suite.
	const {
		KnowledgeChunksProvider,
	} = require("../../src/modules/knowledge-chunks/knowledge-chunks.provider");
	const {
		KnowledgeChunksWorker,
	} = require("../../src/modules/knowledge-chunks/knowledge-chunks.worker");
	const { ConfigService } = require("@nestjs/config");
	const { survivalSourceFixtureOutput } =
		require("../support/prepared-survival-source") as typeof import(
			"../support/prepared-survival-source"
		);
	const provider = app.get(KnowledgeChunksProvider) as import(
		"../../src/modules/knowledge-chunks/knowledge-chunks.provider"
	).KnowledgeChunksProvider;
	provider.isAvailable = async () => true;
	provider.generate = async (set, _bytes, title) => survivalSourceFixtureOutput(set, title);
	app.get(ConfigService).set("KNOWLEDGE_WORKER_ENABLED", "true");
	app.get(KnowledgeChunksWorker).onModuleInit();
	await app.listen(3050, "127.0.0.1");
}
void start().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
