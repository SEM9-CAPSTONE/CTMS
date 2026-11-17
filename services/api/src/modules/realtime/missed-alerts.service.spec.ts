import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { DataSource } from "typeorm";
import { MissedAlertsService } from "./missed-alerts.service";

const NOW = new Date("2026-11-17T07:00:00Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const row = (n: number) => ({ sourceId: id(n), occurredAt: NOW, details: {} });

function setup() {
	const jwt = new JwtService({ secret: "access-token-test-secret" });
	const query = jest.fn();
	const service = new MissedAlertsService(
		{ query } as unknown as DataSource,
		jwt,
		new ConfigService({ JWT_SECRET: "access-token-test-secret" })
	);
	return { service, query, jwt };
}

it("paginates a shared timestamp by source-prefixed identity using an account-bound cursor", async () => {
	const { service, query, jwt } = setup();
	query
		.mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => row(i)))
		.mockResolvedValueOnce([{ ...row(0), readAt: null }])
		.mockResolvedValueOnce([row(0), row(1)]);
	const first = await service.list(id(500), undefined, NOW);
	expect(first.items).toHaveLength(200);
	expect(first.items[0]).toMatchObject({ dedupKey: `broadcast:${id(0)}` });
	expect(first.items[0]).not.toHaveProperty("readAt");
	const cursor = first.nextCursor ?? "";
	expect(cursor).not.toBe("");
	expect(() => jwt.verify(cursor)).toThrow();
	await expect(service.list(id(501), cursor, NOW)).rejects.toMatchObject({ status: 422 });
	await expect(service.list(id(500), `${cursor}invalid`, NOW)).rejects.toMatchObject({
		status: 422,
	});
	await expect(
		service.list(id(500), cursor, new Date(NOW.getTime() + 86_400_000))
	).rejects.toMatchObject({ status: 422 });

	query
		.mockResolvedValueOnce([])
		.mockResolvedValueOnce([{ ...row(0), readAt: null }])
		.mockResolvedValueOnce([row(1), row(0)]);
	const second = await service.list(id(500), cursor, NOW);
	expect(query.mock.calls[3][1].slice(3, 6)).toEqual([
		NOW.toISOString(),
		"broadcast",
		`broadcast:${id(199)}`,
	]);
	expect(second.items.map(({ dedupKey }) => dedupKey)).toEqual([
		`notification:${id(0)}`,
		`sos:${id(0)}`,
		`sos:${id(1)}`,
	]);
	expect(second.items[0]).toHaveProperty("readAt", null);
	expect(second.items[1]).not.toHaveProperty("readAt");
});

it("returns the available sources and holds pagination when a source fails", async () => {
	const { service, query } = setup();
	query
		.mockResolvedValueOnce([row(1)])
		.mockRejectedValueOnce(new Error("database error"))
		.mockResolvedValueOnce([row(2)]);
	await expect(service.list(id(500), undefined, NOW)).resolves.toMatchObject({
		items: [{ source: "broadcast" }, { source: "sos" }],
		failedSources: ["notification"],
		nextCursor: null,
		recoveryMode: "backfill",
	});
});
