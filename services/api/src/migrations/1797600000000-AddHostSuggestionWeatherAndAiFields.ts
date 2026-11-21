import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddHostSuggestionWeatherAndAiFields1797600000000 implements MigrationInterface {
	async up(q: QueryRunner): Promise<void> {
		await q.query(`
			ALTER TABLE host_trip_suggestions
				ADD COLUMN IF NOT EXISTS suggested_starts_at TIMESTAMPTZ NULL,
				ADD COLUMN IF NOT EXISTS weather_summary JSONB NULL,
				ADD COLUMN IF NOT EXISTS ai_season_note VARCHAR(280) NULL,
				ADD COLUMN IF NOT EXISTS ai_risks JSONB NULL,
				ADD COLUMN IF NOT EXISTS ai_confidence VARCHAR(16) NULL
					CHECK (ai_confidence IS NULL OR ai_confidence IN ('low', 'medium'));
		`);
	}

	async down(q: QueryRunner): Promise<void> {
		await q.query(`
			ALTER TABLE host_trip_suggestions
				DROP COLUMN IF EXISTS ai_confidence,
				DROP COLUMN IF EXISTS ai_risks,
				DROP COLUMN IF EXISTS ai_season_note,
				DROP COLUMN IF EXISTS weather_summary,
				DROP COLUMN IF EXISTS suggested_starts_at;
		`);
	}
}
