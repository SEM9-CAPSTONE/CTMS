import type { MigrationInterface, QueryRunner } from "typeorm";

/** Repair databases that ran the original draft migration with a `values` column. */
export class NormalizeTripFormDraftValues1793000000002 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		if (await q.hasColumn("trip_form_drafts", "form_values")) return;

		if (await q.hasColumn("trip_form_drafts", "values")) {
			// Rename in place so existing draft contents, constraints and image links survive.
			await q.query('ALTER TABLE trip_form_drafts RENAME COLUMN "values" TO form_values');
			return;
		}

		// Do not manufacture empty form contents for an unrecognized populated schema.
		const rows: { exists: boolean }[] = await q.query(
			"SELECT EXISTS(SELECT 1 FROM trip_form_drafts) AS exists"
		);
		if (rows[0]?.exists) {
			throw new Error(
				"Cannot repair trip_form_drafts: neither form_values nor the legacy values column exists. Inspect the existing draft columns before migrating; no draft data was changed."
			);
		}
		await q.query("ALTER TABLE trip_form_drafts ADD COLUMN form_values jsonb NOT NULL");
	}

	async down(): Promise<void> {
		// Keep the canonical column: on new databases up() was a no-op, and renaming
		// it back would break the original migration's schema and current service.
	}
}
