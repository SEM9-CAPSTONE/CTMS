const { spawnSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 2_000;
const CHECK_TIMEOUT_MS = 5_000;

function runDocker(args, timeout = CHECK_TIMEOUT_MS) {
	return spawnSync("docker", args, {
		encoding: "utf8",
		timeout,
		windowsHide: true,
	});
}

async function ensureDocker() {
	const initialCheck = runDocker(["info", "--format", "{{.ServerVersion}}"]);
	if (initialCheck.error?.code === "ENOENT") {
		throw new Error("Docker chưa được cài hoặc chưa có trong PATH.");
	}
	if (initialCheck.status === 0) return;

	console.info("Docker Engine chưa sẵn sàng. Đang khởi động Docker Desktop...");
	const start = runDocker(["desktop", "start", "--detach"], 20_000);
	if (start.status !== 0) {
		throw new Error(
			`Không khởi động được Docker Desktop. Hãy mở Docker Desktop và thử lại.\n${start.stderr?.trim() || start.error?.message || start.stdout?.trim() || ""}`
		);
	}

	const deadline = Date.now() + STARTUP_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (runDocker(["info", "--format", "{{.ServerVersion}}"]).status === 0) {
			console.info("Docker Engine đã sẵn sàng.");
			return;
		}
		await delay(POLL_INTERVAL_MS);
	}
	throw new Error(
		"Docker Engine chưa sẵn sàng sau 120 giây. Kiểm tra trạng thái Engine trong Docker Desktop rồi chạy lại lệnh."
	);
}

ensureDocker().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
