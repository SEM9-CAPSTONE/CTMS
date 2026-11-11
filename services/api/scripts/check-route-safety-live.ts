import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { NchmfSafetyService } from "../src/modules/route-safety/nchmf-safety.service";
import { OsmWaterService } from "../src/modules/route-safety/osm-water.service";
import { isSafetyGeometry } from "../src/modules/route-safety/safety-input";
import { VndmsSafetyService } from "../src/modules/route-safety/vndms-safety.service";

async function main(): Promise<void> {
	const geometry: unknown = process.env.SMOKE_ROUTE
		? JSON.parse(process.env.SMOKE_ROUTE)
		: {
				type: "LineString",
				coordinates: [
					[108.43, 11.94],
					[108.431, 11.941],
				],
			};
	if (!isSafetyGeometry(geometry) || geometry.type !== "LineString")
		throw new Error("SMOKE_ROUTE must be a valid WGS84 LineString");
	const config = new ConfigService();
	const results = await Promise.all([
		new NchmfSafetyService(config).collect(geometry),
		new VndmsSafetyService(config).collect(),
		new OsmWaterService(config).collect(geometry, 300),
	]);
	process.stdout.write(
		`${JSON.stringify(
			{
				scope: "Provider collection before PostGIS route filtering",
				geometry,
				results: results.map((result) => ({
					...result.source,
					collected: result.candidates.length,
					examples: result.candidates.slice(0, 2).map((c) => ({
						id: c.id,
						sourceType: c.sourceType,
						geometryType: c.geometry.type,
						lifecycleStatus: c.lifecycleStatus,
						observedAt: c.observedAt,
						sourceReference: c.sourceReference,
					})),
				})),
			},
			null,
			2
		)}\n`
	);
	if (results.some((result) => result.source.status === "UNAVAILABLE")) process.exitCode = 1;
}
main().catch((error: unknown) => {
	process.stderr.write(`${String(error)}\n`);
	process.exitCode = 1;
});
