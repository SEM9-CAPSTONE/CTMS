import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource, type EntityManager } from "typeorm";
import type { GeoAreaResponseDto } from "./dto/geo-area-response.dto";

const SELECT_AREA = `
	SELECT "code", "name", "province_code" AS "provinceCode", "province_name" AS "provinceName"
	FROM "geo_areas"
`;

@Injectable()
export class GeoAreasService {
	constructor(private readonly dataSource: DataSource) {}

	async listActive(): Promise<GeoAreaResponseDto[]> {
		return this.dataSource.query(
			`${SELECT_AREA} WHERE "active" = true ORDER BY "province_name", "sort_order", "name"`
		);
	}

	async findActiveByCode(
		code: string,
		manager?: EntityManager
	): Promise<GeoAreaResponseDto | null> {
		const runner = manager ?? this.dataSource;
		const rows = (await runner.query(`${SELECT_AREA} WHERE "code" = $1 AND "active" = true`, [
			code,
		])) as GeoAreaResponseDto[];
		return rows[0] ?? null;
	}
}
