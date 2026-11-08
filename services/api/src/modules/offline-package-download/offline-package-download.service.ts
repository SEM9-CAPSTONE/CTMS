import {
	ConflictException,
	Injectable,
	NotFoundException,
	ServiceUnavailableException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackagesService } from "../offline-packages/offline-packages.service";
import {
	MAX_PACKAGE_BYTES,
	PACKAGE_SCHEMA_VERSION,
	PackageFailure,
} from "../offline-packages/offline-packages.types";
// biome-ignore lint/style/useImportType: Nest injection metadata
import { OfflinePackageAccessRepository } from "./offline-package-access.repository";
import { packageByteRange } from "./package-byte-range";

export interface DownloadPackageMetadata {
	id: string;
	tripId: string;
	packageVersion: number;
	schemaVersion: number;
	sha256: string;
	sizeBytes: number;
	generatedAt: string;
	contentType: "application/zip";
	etag: string;
}
export interface PackageDownloadResponse {
	status: number;
	headers: Record<string, string>;
	bytes: Buffer;
}

@Injectable()
export class OfflinePackageDownloadService {
	constructor(
		private readonly access: OfflinePackageAccessRepository,
		private readonly packages: OfflinePackagesService
	) {}
	private async authorize(userId: string, tripId: string): Promise<void> {
		if (!(await this.access.canDownload(tripId, userId)))
			throw new NotFoundException({ code: "TRIP_NOT_ACCESSIBLE", message: "Trip not found" });
	}
	async metadata(
		userId: string,
		tripId: string,
		version?: number
	): Promise<DownloadPackageMetadata> {
		await this.authorize(userId, tripId);
		const row = await this.packages.getReadyMetadata(tripId, version);
		if (!row)
			throw new ConflictException({
				code: "PACKAGE_NOT_READY",
				message: "Offline package is not ready",
			});
		if (
			row.tripId !== tripId ||
			row.schemaVersion !== PACKAGE_SCHEMA_VERSION ||
			!Number.isSafeInteger(row.packageVersion) ||
			row.packageVersion < 1 ||
			row.contentType !== "application/zip" ||
			(version !== undefined && row.packageVersion !== version) ||
			!Number.isSafeInteger(row.sizeBytes) ||
			row.sizeBytes <= 0 ||
			row.sizeBytes > MAX_PACKAGE_BYTES ||
			!/^[a-f0-9]{64}$/.test(row.sha256)
		)
			throw new ConflictException({
				code: "PACKAGE_UNSUPPORTED",
				message: "Unsupported offline package",
			});
		return {
			id: row.id,
			tripId: row.tripId,
			packageVersion: row.packageVersion,
			schemaVersion: row.schemaVersion,
			sha256: row.sha256,
			sizeBytes: row.sizeBytes,
			generatedAt: row.generatedAt,
			contentType: row.contentType,
			etag: `"${row.sha256}"`,
		};
	}
	async download(
		userId: string,
		tripId: string,
		version: number,
		range?: string,
		ifRange?: string
	): Promise<PackageDownloadResponse> {
		const metadata = await this.metadata(userId, tripId, version);
		const headers: Record<string, string> = {
			"Cache-Control": "private, no-store, no-transform",
			"Accept-Ranges": "bytes",
			ETag: metadata.etag,
			"Content-Type": metadata.contentType,
			"Content-Disposition": `attachment; filename="ctms-${tripId}-v${version}.zip"`,
			"X-Content-Type-Options": "nosniff",
		};
		// If-Range accepts only this representation's strong ETag; mismatches restart at byte zero.
		const selected = packageByteRange(
			ifRange && ifRange !== metadata.etag ? undefined : range,
			metadata.sizeBytes
		);
		if (selected === null)
			return {
				status: 416,
				headers: {
					...headers,
					"Content-Range": `bytes */${metadata.sizeBytes}`,
					"Content-Length": "0",
				},
				bytes: Buffer.alloc(0),
			};
		let bytes: Buffer | null;
		try {
			// CTMS-052 checks private storage, digest and archive before returning (bounded to 20 MiB).
			bytes = await this.packages.readArtifact(tripId, version);
		} catch (error) {
			if (!(error instanceof PackageFailure)) throw error;
			throw new ServiceUnavailableException({
				code: "PACKAGE_ARTIFACT_UNAVAILABLE",
				message: "Offline package is temporarily unavailable",
			});
		}
		if (!bytes || bytes.length !== metadata.sizeBytes)
			throw new ServiceUnavailableException({
				code: "PACKAGE_ARTIFACT_UNAVAILABLE",
				message: "Offline package is temporarily unavailable",
			});
		// Catch participation withdrawn while private bytes were being read/verified.
		await this.authorize(userId, tripId);
		const body = selected ? bytes.subarray(selected.start, selected.end + 1) : bytes;
		if (selected)
			headers["Content-Range"] = `bytes ${selected.start}-${selected.end}/${metadata.sizeBytes}`;
		headers["Content-Length"] = String(body.length);
		return { status: selected ? 206 : 200, headers, bytes: body };
	}
}
