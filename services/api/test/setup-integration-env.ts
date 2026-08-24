const DEFAULT_TEST_DATABASE_URL = "postgresql://ctms:ctms@127.0.0.1:5432/ctms_test";

const databaseUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

if (!databaseName.endsWith("_test")) {
	throw new Error(
		`Refusing to run integration tests against database "${databaseName}". Use a database name ending with "_test".`
	);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "integration-test-secret";
process.env.JWT_ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_TOKEN_TTL ?? "15m";
process.env.JWT_REFRESH_TOKEN_TTL = process.env.JWT_REFRESH_TOKEN_TTL ?? "7d";
process.env.OTP_TTL_MINUTES = process.env.OTP_TTL_MINUTES ?? "10";
process.env.OTP_RESEND_MAX_ATTEMPTS = process.env.OTP_RESEND_MAX_ATTEMPTS ?? "5";
process.env.OTP_RESEND_WINDOW_MINUTES = process.env.OTP_RESEND_WINDOW_MINUTES ?? "1440";
