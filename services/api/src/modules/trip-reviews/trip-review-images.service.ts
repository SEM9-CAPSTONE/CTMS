import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource } from "typeorm";
// biome-ignore lint/style/useImportType: Nest injection
import { UploadsService } from "../uploads/uploads.service";

@Injectable()
export class TripReviewImagesService {
	constructor(
		private readonly storage: UploadsService,
		private readonly source: DataSource
	) {}
	async upload(userId: string, file?: Express.Multer.File) {
		const b = file?.buffer;
		const valid =
			b &&
			((file.mimetype === "image/jpeg" && b.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
				(file.mimetype === "image/png" &&
					b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
				(file.mimetype === "image/webp" &&
					b.subarray(0, 4).toString() === "RIFF" &&
					b.subarray(8, 12).toString() === "WEBP"));
		if (!valid || !file)
			throw new BadRequestException("Only JPEG, PNG and WebP images are allowed");
		const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
			file.mimetype
		];
		const stored = await this.storage.uploadImage(
			{ ...file, originalname: `review.${extension}` },
			"trip-reviews"
		);
		await this.source.query(
			"INSERT INTO trip_review_uploads (id, reviewer_id, url) VALUES ($1,$2,$3)",
			[randomUUID(), userId, stored.url]
		);
		return stored;
	}
}
