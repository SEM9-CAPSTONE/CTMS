const { execSync } = require("node:child_process");

const ALLOWED_BRANCH_PATTERNS = [
	/^(feature|feat)\/[a-z0-9._-]+$/,
	/^(bugfix|fix)\/[a-z0-9._-]+$/,
	/^hotfix\/[a-z0-9._-]+$/,
	/^refactor\/[a-z0-9._-]+$/,
	/^chore\/[a-z0-9._-]+$/,
	/^docs\/[a-z0-9._-]+$/,
	/^test\/[a-z0-9._-]+$/,
	/^release\/[a-z0-9._-]+$/,
	/^(main|master|develop|staging)$/,
];

function getCurrentBranch() {
	try {
		return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
	} catch (_error) {
		console.error("❌ Không thể xác định tên Git branch hiện tại.");
		process.exit(1);
	}
}

function main() {
	const branchName = getCurrentBranch();
	console.log(`🔍 Checking Git branch name: "${branchName}"...`);

	const isValid = ALLOWED_BRANCH_PATTERNS.some((pattern) => pattern.test(branchName));

	if (!isValid) {
		console.error("\n❌ Tên branch không tuân thủ quy chuẩn dự án!");
		console.error(`👉 Tên branch hiện tại: "${branchName}"`);
		console.error("\n✅ Vui lòng đặt tên branch theo định dạng:");
		console.error("   - feature/<tên-tính-năng> hoặc feat/<tên-tính-năng>");
		console.error("   - fix/<tên-lỗi> hoặc bugfix/<tên-lỗi>");
		console.error("   - hotfix/<nội-dung-vá>");
		console.error("   - refactor/<nội-dung-tối-ưu>");
		console.error("   - chore/<tác-vụ-cấu-hình>");
		console.error("   - docs/<tài-liệu>");
		console.error("   - Ví dụ: feat/auth-login, fix/header-logo, refactor/route-guard\n");
		process.exit(1);
	}

	console.log("✅ Tên branch hợp lệ. Tiến hành push!\n");
}

main();
