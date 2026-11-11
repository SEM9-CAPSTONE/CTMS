import type { DataSource } from "typeorm";

export async function assertSafeTestDatabase(dataSource: DataSource): Promise<void> {
	const rows = (await dataSource.query("SELECT current_database() AS database")) as Array<{
		database: string;
	}>;
	const database = rows[0]?.database ?? "";

	if (!database.endsWith("_test")) {
		throw new Error(
			`Refusing destructive test cleanup on database "${database}". Integration tests must use a database ending with "_test".`
		);
	}
}
