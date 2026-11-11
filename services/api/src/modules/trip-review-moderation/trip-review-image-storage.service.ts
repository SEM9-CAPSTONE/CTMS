import { existsSync, mkdirSync } from "node:fs";
import { rename } from "node:fs/promises";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { getUploadRoot } from "../../shared/uploads/upload-paths";

@Injectable()
export class TripReviewImageStorageService {
	private readonly logger = new Logger(TripReviewImageStorageService.name);

	private get liveDirectory(): string {
		return join(getUploadRoot(), "trip-reviews");
	}

	private get quarantineDirectory(): string {
		return join(getUploadRoot(), "quarantine", "trip-reviews");
	}

	/**
	 * Extract the filename component from a review image URL.
	 */
	extractFilename(url: string): string | null {
		if (!url) return null;
		try {
			const parsed = new URL(url, "http://localhost");
			const match = /\/uploads\/(?:quarantine\/)?trip-reviews\/([^/?#]+)$/.exec(parsed.pathname);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	}

	/**
	 * Move images from public uploads directory to private quarantine directory.
	 */
	async quarantineImages(imageUrls: string[]): Promise<boolean> {
		if (!imageUrls || imageUrls.length === 0) return true;

		mkdirSync(this.quarantineDirectory, { recursive: true });

		for (const url of imageUrls) {
			const filename = this.extractFilename(url);
			if (!filename) {
				this.logger.debug(`Non-local or unparseable image URL skipped from physical move: ${url}`);
				continue;
			}

			const sourcePath = join(this.liveDirectory, filename);
			const targetPath = join(this.quarantineDirectory, filename);

			if (existsSync(sourcePath)) {
				try {
					await rename(sourcePath, targetPath);
					this.logger.log(`Quarantined image: ${filename}`);
				} catch (err) {
					this.logger.error(`Failed to quarantine image ${filename}: ${err}`);
					return false;
				}
			} else {
				this.logger.warn(`Image file not found on disk for quarantine: ${sourcePath}`);
			}
		}

		return true;
	}

	/**
	 * Move images from private quarantine directory back to public uploads directory.
	 */
	async restoreImages(imageUrls: string[]): Promise<boolean> {
		if (!imageUrls || imageUrls.length === 0) return true;

		mkdirSync(this.liveDirectory, { recursive: true });

		for (const url of imageUrls) {
			const filename = this.extractFilename(url);
			if (!filename) continue;

			const sourcePath = join(this.quarantineDirectory, filename);
			const targetPath = join(this.liveDirectory, filename);

			if (existsSync(sourcePath)) {
				try {
					await rename(sourcePath, targetPath);
					this.logger.log(`Restored quarantined image: ${filename}`);
				} catch (err) {
					this.logger.error(`Failed to restore image ${filename}: ${err}`);
					return false;
				}
			} else {
				this.logger.warn(`Quarantined image not found on disk for restore: ${sourcePath}`);
			}
		}

		return true;
	}

	/**
	 * Resolves the physical path of a quarantined image on disk.
	 */
	getQuarantinedPath(url: string): string | null {
		const filename = this.extractFilename(url);
		if (!filename) return null;
		const quarantinedPath = join(this.quarantineDirectory, filename);
		if (existsSync(quarantinedPath)) return quarantinedPath;
		const livePath = join(this.liveDirectory, filename);
		return existsSync(livePath) ? livePath : null;
	}
}
