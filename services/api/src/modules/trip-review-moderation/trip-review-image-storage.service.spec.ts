import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getUploadRoot } from "../../shared/uploads/upload-paths";
import { TripReviewImageStorageService } from "./trip-review-image-storage.service";

describe("TripReviewImageStorageService", () => {
	let service: TripReviewImageStorageService;
	const uploadRoot = getUploadRoot();
	const liveDir = join(uploadRoot, "trip-reviews");
	const quarantineDir = join(uploadRoot, "quarantine", "trip-reviews");

	beforeEach(() => {
		service = new TripReviewImageStorageService();
		mkdirSync(liveDir, { recursive: true });
		mkdirSync(quarantineDir, { recursive: true });
	});

	afterEach(() => {
		try {
			rmSync(join(uploadRoot, "quarantine"), { recursive: true, force: true });
		} catch {
			// ignore cleanup errors
		}
	});

	describe("extractFilename", () => {
		it("extracts filename from relative path", () => {
			expect(service.extractFilename("/uploads/trip-reviews/pic-123.jpg")).toBe("pic-123.jpg");
		});

		it("extracts filename from absolute URL", () => {
			expect(service.extractFilename("http://localhost:3000/uploads/trip-reviews/sample.png")).toBe(
				"sample.png"
			);
		});

		it("extracts filename from quarantined URL", () => {
			expect(service.extractFilename("/uploads/quarantine/trip-reviews/violation.webp")).toBe(
				"violation.webp"
			);
		});

		it("returns null for non-matching URLs", () => {
			expect(service.extractFilename("")).toBeNull();
			expect(service.extractFilename("/other/path/image.jpg")).toBeNull();
		});
	});

	describe("quarantineImages and restoreImages", () => {
		it("returns true when image list is empty", async () => {
			expect(await service.quarantineImages([])).toBe(true);
			expect(await service.restoreImages([])).toBe(true);
		});

		it("quarantines existing file and restores it back", async () => {
			const filename = "test-quarantine-img.jpg";
			const livePath = join(liveDir, filename);
			const quarantinePath = join(quarantineDir, filename);

			writeFileSync(livePath, "dummy image content");
			expect(existsSync(livePath)).toBe(true);
			expect(existsSync(quarantinePath)).toBe(false);

			const url = `/uploads/trip-reviews/${filename}`;

			// Quarantine
			const qSuccess = await service.quarantineImages([url]);
			expect(qSuccess).toBe(true);
			expect(existsSync(livePath)).toBe(false);
			expect(existsSync(quarantinePath)).toBe(true);

			// Check getQuarantinedPath
			expect(service.getQuarantinedPath(url)).toBe(quarantinePath);

			// Restore
			const rSuccess = await service.restoreImages([url]);
			expect(rSuccess).toBe(true);
			expect(existsSync(livePath)).toBe(true);
			expect(existsSync(quarantinePath)).toBe(false);

			// Cleanup
			rmSync(livePath, { force: true });
		});

		it("handles non-existent file gracefully during quarantine", async () => {
			const result = await service.quarantineImages(["/uploads/trip-reviews/non-existent.jpg"]);
			expect(result).toBe(true);
		});
	});
});
