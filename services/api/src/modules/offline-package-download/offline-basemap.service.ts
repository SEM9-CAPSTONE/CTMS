import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { ConflictException, Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { DataSource } from "typeorm";
import { getUploadRoot } from "../../shared/uploads/upload-paths";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";

export interface BasemapMetadata {
	packageId: string;
	tripId: string;
	packageVersion: number;
	sha256: string;
	sizeBytes: number;
	bounds: number[];
	minZoom: number;
	maxZoom: number;
	attribution: string;
	licenseUrl: string;
}

@Injectable()
export class OfflineBasemapService {
	constructor(
		private readonly db: DataSource,
		private readonly access: OfflinePackageAccessRepository
	) {}

	async metadata(userId: string, tripId: string, version: number): Promise<BasemapMetadata> {
		if (!(await this.access.downloadableTripStatus(tripId, userId)))
			throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE" });
		const rows: BasemapMetadata[] = await this.db.query(
			`SELECT p.id AS "packageId",p.trip_id AS "tripId",
      p.package_version AS "packageVersion", b.sha256,b.size_bytes AS "sizeBytes",b.bounds,
      b.min_zoom AS "minZoom", b.max_zoom AS "maxZoom",b.attribution,b.license_url AS "licenseUrl"
      FROM offline_packages p JOIN offline_basemaps b ON b.package_id=p.id
      WHERE p.trip_id=$1 AND p.package_version=$2`,
			[tripId, version]
		);
		if (!rows[0]) throw new ConflictException({ code: "BASEMAP_NOT_READY" });
		return rows[0];
	}

	async download(userId: string, tripId: string, version: number): Promise<StreamableFile> {
		const meta = await this.metadata(userId, tripId, version);
		if (!/^[a-f0-9]{64}$/.test(meta.sha256))
			throw new ConflictException({ code: "BASEMAP_INVALID" });
		const root = resolve(process.env.OFFLINE_BASEMAP_STORAGE_ROOT ?? ".private-offline-basemaps");
		const publicRelative = relative(resolve(getUploadRoot()), root);
		if (
			!isAbsolute(publicRelative) &&
			publicRelative !== ".." &&
			!publicRelative.startsWith(`..${sep}`)
		) {
			throw new ConflictException({ code: "BASEMAP_INVALID" });
		}
		const path = resolve(root, `${meta.sha256}.mbtiles`);
		try {
			if ((await stat(path)).size !== meta.sizeBytes) throw new Error("size");
			const hash = createHash("sha256");
			for await (const chunk of createReadStream(path)) hash.update(chunk);
			if (hash.digest("hex") !== meta.sha256) throw new Error("hash");
		} catch {
			throw new ConflictException({ code: "BASEMAP_INVALID" });
		}
		return new StreamableFile(createReadStream(path), {
			type: "application/vnd.sqlite3",
			length: meta.sizeBytes,
			disposition: `attachment; filename="${tripId}-v${version}.mbtiles"`,
		});
	}
}
