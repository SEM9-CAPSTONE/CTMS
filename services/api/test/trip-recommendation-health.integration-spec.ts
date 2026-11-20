import { DataSource, type QueryRunner } from "typeorm";
import { AllowHealthProfileRecommendationSignal1797400000000 } from "../src/migrations/1797400000000-AllowHealthProfileRecommendationSignal";
import { AddHealthActivityProfile1797500000000 } from "../src/migrations/1797500000000-AddHealthActivityProfile";
import { SimplifyHealthActivityProfile1797600000000 } from "../src/migrations/1797600000000-SimplifyHealthActivityProfile";
import { TripRecommendationsRepository } from "../src/modules/trip-recommendations/trip-recommendations.repository";
import { assertSafeTestDatabase } from "./support/assert-safe-test-database";

const CAMPER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

describe("Recommendation health consent and profile data (real Postgres)", () => {
	let ds: DataSource;
	let runner: QueryRunner;
	let repository: TripRecommendationsRepository;
	const migration = new AllowHealthProfileRecommendationSignal1797400000000();

	beforeAll(async () => {
		ds = new DataSource({ type: "postgres", url: process.env.DATABASE_URL });
		await ds.initialize();
		await assertSafeTestDatabase(ds);
	});

	beforeEach(async () => {
		runner = ds.createQueryRunner();
		await runner.connect();
		await runner.startTransaction();
		// Connection-local tables exercise the production SQL without creating accounts or changing application data.
		await runner.query(`CREATE TEMP TABLE health_profiles (
			user_id uuid PRIMARY KEY, physical_fitness_level varchar NOT NULL,
			medical_conditions jsonb NOT NULL DEFAULT '[]', is_consent_granted boolean NOT NULL DEFAULT false,
			allergies jsonb NOT NULL DEFAULT '[]', dietary_restrictions text,
			version integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
		) ON COMMIT DROP`);
		await new AddHealthActivityProfile1797500000000().up(runner);
		await runner.query(`CREATE TEMP TABLE trip_recommendation_runs (
			signal_type varchar NOT NULL,
			CONSTRAINT "CHK_trip_recommendation_runs_signal" CHECK (signal_type IN ('preferences', 'history', 'preferences_and_history'))
		) ON COMMIT DROP`);
		repository = new TripRecommendationsRepository({
			query: runner.query.bind(runner),
		} as unknown as DataSource);
	});

	afterEach(async () => {
		await runner.rollbackTransaction();
		await runner.release();
	});

	afterAll(async () => {
		if (ds?.isInitialized) await ds.destroy();
	});

	it("requires the requesting Camper's stored consent, including missing and revoked profiles", async () => {
		expect(await repository.findHealthSignal(CAMPER_ID)).toBeNull();
		await runner.query(
			`INSERT INTO health_profiles (user_id,physical_fitness_level,medical_conditions,is_consent_granted) VALUES ($1,'EXPERT','[]',true),($2,'BEGINNER','[]',false)`,
			[OTHER_ID, CAMPER_ID]
		);
		expect(await repository.findHealthSignal(CAMPER_ID)).toBeNull();
		await runner.query("UPDATE health_profiles SET is_consent_granted=true WHERE user_id=$1", [
			CAMPER_ID,
		]);
		expect(await repository.findHealthSignal(CAMPER_ID)).toMatchObject({
			fitnessLevel: "BEGINNER",
			hasMedicalConditions: false,
		});
		await runner.query("UPDATE health_profiles SET is_consent_granted=false WHERE user_id=$1", [
			CAMPER_ID,
		]);
		expect(await repository.findHealthSignal(CAMPER_ID)).toBeNull();
	});

	it("reads changed fitness and condition facts from the persisted profile without a default substitute", async () => {
		await runner.query(
			`INSERT INTO health_profiles (user_id,physical_fitness_level,medical_conditions,is_consent_granted) VALUES ($1,'BEGINNER','[]',true)`,
			[CAMPER_ID]
		);
		expect((await repository.findHealthSignal(CAMPER_ID))?.fitnessLevel).toBe("BEGINNER");
		await runner.query(
			`UPDATE health_profiles SET physical_fitness_level='ADVANCED',medical_conditions='[{"name":"Hen suyễn"}]' WHERE user_id=$1`,
			[CAMPER_ID]
		);
		expect(await repository.findHealthSignal(CAMPER_ID)).toMatchObject({
			fitnessLevel: "ADVANCED",
			hasMedicalConditions: true,
		});
	});

	it("reads activity facts from the database, leaves missing facts unknown and preserves them on migration rollback", async () => {
		await runner.query(
			`INSERT INTO health_profiles (user_id,physical_fitness_level,medical_conditions,is_consent_granted) VALUES ($1,'INTERMEDIATE','[]',true)`,
			[CAMPER_ID]
		);
		expect((await repository.findHealthSignal(CAMPER_ID))?.activityProfile).toBeNull();
		const activity = {
			comfortableDistanceKm: 4,
			comfortableWalkingMinutes: 120,
			activityNotes: null,
			confirmedAt: "2026-11-19T12:00:00Z",
		};
		await runner.query("UPDATE health_profiles SET activity_profile=$2 WHERE user_id=$1", [
			CAMPER_ID,
			activity,
		]);
		expect((await repository.findHealthSignal(CAMPER_ID))?.activityProfile).toEqual(activity);
		await expect(new AddHealthActivityProfile1797500000000().down(runner)).rejects.toThrow(
			"preserve user-provided health information"
		);
	});

	it("merges complete legacy notes and removes weekly frequency without changing activity facts", async () => {
		const old = {
			weeklyActiveDays: 3,
			comfortableDistanceKm: 8,
			comfortableWalkingMinutes: 180,
			mobilityLimitations: "a".repeat(500),
			professionalAdvice: "b".repeat(500),
			confirmedAt: "2026-11-19T12:00:00Z",
		};
		await runner.query(
			`INSERT INTO health_profiles(user_id,physical_fitness_level,is_consent_granted,activity_profile)
			VALUES ($1,'INTERMEDIATE',true,$2),($3,'INTERMEDIATE',true,$4)`,
			[
				CAMPER_ID,
				old,
				OTHER_ID,
				{
					weeklyActiveDays: 4,
					mobilityLimitations: "Cần nghỉ giữa chặng",
					professionalAdvice: "Cần nghỉ giữa chặng",
					confirmedAt: null,
				},
			]
		);
		const simplify = new SimplifyHealthActivityProfile1797600000000();
		await simplify.up(runner);
		const profile = (await repository.findHealthSignal(CAMPER_ID))?.activityProfile;
		expect(profile).toEqual({
			comfortableDistanceKm: 8,
			comfortableWalkingMinutes: 180,
			activityNotes: `${"a".repeat(500)}\n\n${"b".repeat(500)}`,
			confirmedAt: old.confirmedAt,
		});
		expect((await repository.findHealthSignal(OTHER_ID))?.activityProfile?.activityNotes).toBe(
			"Cần nghỉ giữa chặng"
		);
		await simplify.down(runner);
		const [restored] = await runner.query(
			"SELECT activity_profile FROM health_profiles WHERE user_id=$1",
			[CAMPER_ID]
		);
		expect(restored.activity_profile.mobilityLimitations).toBe(profile?.activityNotes);
		await simplify.up(runner);
		expect((await repository.findHealthSignal(CAMPER_ID))?.activityProfile).toEqual(profile);
	});

	it("accepts a profile-only generation and refuses rollback that would lose history", async () => {
		await runner.query(`INSERT INTO trip_recommendation_runs VALUES ('preferences')`);
		await migration.up(runner);
		await runner.query(`INSERT INTO trip_recommendation_runs VALUES ('health_profile')`);
		await expect(migration.down(runner)).rejects.toThrow("preserve recommendation history");
		const rows = await runner.query(
			"SELECT signal_type FROM trip_recommendation_runs ORDER BY signal_type"
		);
		expect(rows).toEqual([{ signal_type: "health_profile" }, { signal_type: "preferences" }]);
	});

	it("can roll back before any profile-only generation exists", async () => {
		await migration.up(runner);
		await migration.down(runner);
		await expect(
			runner.query(`INSERT INTO trip_recommendation_runs VALUES ('health_profile')`)
		).rejects.toMatchObject({ driverError: { constraint: "CHK_trip_recommendation_runs_signal" } });
	});
});
