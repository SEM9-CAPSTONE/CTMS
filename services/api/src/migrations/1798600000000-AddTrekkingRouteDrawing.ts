import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddTrekkingRouteDrawing1798600000000 implements MigrationInterface {
	async up(runner: QueryRunner): Promise<void> {
		await runner.query('ALTER TABLE "trekking_routes" ADD COLUMN "route_drawing" jsonb');
	}

	async down(runner: QueryRunner): Promise<void> {
		await runner.query('ALTER TABLE "trekking_routes" DROP COLUMN "route_drawing"');
	}
}
