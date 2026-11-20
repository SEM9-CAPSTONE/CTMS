import type { MigrationInterface, QueryRunner } from "typeorm";

export class SimplifyHealthActivityProfile1797600000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		// Preserve both existing notes, their order, and the original confirmation date.
		await runner.query(`UPDATE health_profiles SET
			activity_profile = (activity_profile - 'weeklyActiveDays' - 'mobilityLimitations' - 'professionalAdvice')
			|| jsonb_build_object('activityNotes', (
				SELECT string_agg(note, E'\n\n' ORDER BY ordinal)
				FROM (
					SELECT note, min(ordinal) AS ordinal
					FROM jsonb_array_elements_text(jsonb_build_array(
						NULLIF(btrim(activity_profile->>'activityNotes'), ''),
						NULLIF(btrim(activity_profile->>'mobilityLimitations'), ''),
						NULLIF(btrim(activity_profile->>'professionalAdvice'), '')
					)) WITH ORDINALITY AS notes(note, ordinal)
					WHERE note IS NOT NULL GROUP BY note
				) merged
			)), version = version + 1, updated_at = now()
			WHERE activity_profile IS NOT NULL AND (
				activity_profile ?| ARRAY['weeklyActiveDays', 'mobilityLimitations', 'professionalAdvice']
				OR NOT activity_profile ? 'activityNotes'
			)`);
	}
	async down(runner: QueryRunner): Promise<void> {
		// Keep the complete merged note in the former limitations field; never split or truncate it.
		await runner.query(`UPDATE health_profiles SET
			activity_profile = (activity_profile - 'activityNotes') || jsonb_build_object(
				'weeklyActiveDays', null,
				'mobilityLimitations', activity_profile->'activityNotes',
				'professionalAdvice', null
			), version = version + 1, updated_at = now()
			WHERE activity_profile IS NOT NULL AND activity_profile ? 'activityNotes'`);
	}
}
