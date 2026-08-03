const { execSync } = require("node:child_process");

const ALLOWED_BRANCH_PATTERNS = [
	/^(feature|feat)\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^(bugfix|fix)\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^hotfix\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^refactor\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^chore\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^docs\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
	/^test\/[A-Z][A-Z0-9]+-[0-9]+(-[a-z0-9._-]+)?$/,
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
		console.error(
			"\n✅ Vui lòng đặt tên branch theo định dạng: <loại-branch>/<mã-Jira-issue>-<nội-dung>"
		);
		console.error("   Trong đó, mã Jira issue phải viết hoa (ví dụ: CTMS-123).");
		console.error("   Các loại branch được phép:");
		console.error("   - feature/<mã-Jira>-<nội-dung> hoặc feat/<mã-Jira>-<nội-dung>");
		console.error("   - fix/<mã-Jira>-<nội-dung> hoặc bugfix/<mã-Jira>-<nội-dung>");
		console.error("   - hotfix/<mã-Jira>-<nội-dung>");
		console.error("   - refactor/<mã-Jira>-<nội-dung>");
		console.error("   - chore/<mã-Jira>-<nội-dung>");
		console.error("   - docs/<mã-Jira>-<nội-dung>");
		console.error("   - test/<mã-Jira>-<nội-dung>");
		console.error(
			"   - Ví dụ: feat/CTMS-123-auth-login, fix/CTMS-456-header-logo, refactor/CTMS-789-route-guard\n"
		);
		process.exit(1);
	}

	console.log("✅ Tên branch hợp lệ. Tiến hành push!\n");
}

main();
