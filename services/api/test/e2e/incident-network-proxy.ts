import { createServer, request } from "node:http";

// Test-only transport fault injector. Every successful API response comes from
// the real server; offline mode drops the connection rather than faking data.
let online = true;
let scenario: { phase: string; fixture: Record<string, unknown> } | null = null;
const server = createServer((incoming, outgoing) => {
	if (incoming.url === "/__e2e/scenario") {
		if (incoming.method === "GET") {
			outgoing.writeHead(scenario ? 200 : 409, { "Content-Type": "application/json" });
			outgoing.end(JSON.stringify(scenario ?? { error: "Run run-incident-e2e.ps1 first" }));
			return;
		}
		if (incoming.method !== "POST") {
			outgoing.writeHead(405);
			outgoing.end();
			return;
		}
		let body = "";
		incoming.on("data", (chunk: Buffer) => {
			body += chunk.toString();
			if (body.length > 16_384) incoming.destroy();
		});
		incoming.on("end", () => {
			try {
				const value = JSON.parse(body) as { phase: string; fixture: Record<string, unknown> };
				if (
					!["capture", "recover"].includes(value.phase) ||
					!value.fixture ||
					typeof value.fixture !== "object"
				)
					throw new Error("Invalid scenario");
				scenario = value;
				outgoing.writeHead(200);
				outgoing.end("ready");
			} catch {
				outgoing.writeHead(400);
				outgoing.end();
			}
		});
		return;
	}
	if (incoming.url === "/__e2e/network" && incoming.method === "POST") {
		let body = "";
		incoming.on("data", (chunk: Buffer) => {
			body += chunk.toString();
			if (body.length > 1024) incoming.destroy();
		});
		incoming.on("end", () => {
			try {
				const value = JSON.parse(body) as { online?: unknown };
				if (typeof value.online !== "boolean") throw new Error("online must be boolean");
				online = value.online;
				console.info(`CTMS49 transport online=${online}`);
				outgoing.writeHead(200, { "Content-Type": "application/json" });
				outgoing.end(JSON.stringify({ online }));
			} catch {
				outgoing.writeHead(400);
				outgoing.end();
			}
		});
		return;
	}
	if (incoming.url === "/__e2e/health") {
		outgoing.end("ready");
		return;
	}
	if (!incoming.url?.startsWith("/api/")) {
		outgoing.writeHead(404);
		outgoing.end();
		return;
	}
	if (!online) {
		outgoing.destroy();
		return;
	}
	console.info(`${incoming.method} ${incoming.url}`);
	const forwarded = request(
		{
			hostname: "127.0.0.1",
			port: 3002,
			path: incoming.url,
			method: incoming.method,
			headers: { ...incoming.headers, host: "127.0.0.1:3002" },
		},
		(response) => {
			console.info(`${incoming.method} ${incoming.url} -> ${response.statusCode}`);
			outgoing.writeHead(response.statusCode ?? 502, response.headers);
			response.pipe(outgoing);
		}
	);
	forwarded.on("error", () => outgoing.destroy());
	incoming.on("aborted", () => forwarded.destroy());
	incoming.pipe(forwarded);
});
server.listen(3003, "0.0.0.0", () => console.info("CTMS49 native E2E proxy on port 3003"));
