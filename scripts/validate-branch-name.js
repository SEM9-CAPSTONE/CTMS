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
		console.error("Cannot determine the current Git branch name.");
		process.exit(1);
	}
}

function main() {
	const branchName = getCurrentBranch();
	console.log(`Checking Git branch name: "${branchName}"...`);

	const isValid = ALLOWED_BRANCH_PATTERNS.some((pattern) => pattern.test(branchName));

	if (!isValid) {
		console.error("\nBranch name does not follow the project convention.");
		console.error(`Current branch: "${branchName}"`);
		console.error(
			"\nUse this format: <branch-type>/<JIRA-KEY>-<short-kebab-description>",
		);
		console.error("The Jira key must be uppercase, for example CTMS-123.");
		console.error("Allowed branch types:");
		console.error("- feature/<JIRA-KEY>-<description> or feat/<JIRA-KEY>-<description>");
		console.error("- fix/<JIRA-KEY>-<description> or bugfix/<JIRA-KEY>-<description>");
		console.error("- hotfix/<JIRA-KEY>-<description>");
		console.error("- refactor/<JIRA-KEY>-<description>");
		console.error("- chore/<JIRA-KEY>-<description>");
		console.error("- docs/<JIRA-KEY>-<description>");
		console.error("- test/<JIRA-KEY>-<description>");
		console.error(
			"Examples: feat/CTMS-123-auth-login, fix/CTMS-456-header-logo, docs/CTMS-789-route-guard\n",
		);
		process.exit(1);
	}

	console.log("Branch name is valid.\n");
}

main();
