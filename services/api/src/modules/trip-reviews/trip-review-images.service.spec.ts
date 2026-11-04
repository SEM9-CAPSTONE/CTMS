import { BadRequestException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import type { UploadsService } from "../uploads/uploads.service";
import { TripReviewImagesService } from "./trip-review-images.service";

describe("TripReviewImagesService", () => {
	const storage = { uploadImage: jest.fn() };
	const source = { query: jest.fn() };
	const service = new TripReviewImagesService(
		storage as unknown as UploadsService,
		source as unknown as DataSource
	);
	const file = (mime: string, bytes: Buffer) =>
		({ mimetype: mime, buffer: bytes, originalname: "unsafe.html" }) as Express.Multer.File;
	beforeEach(() => {
		jest.resetAllMocks();
		storage.uploadImage.mockResolvedValue({ url: "https://example.test/review.png" });
	});
	it.each([
		["image/png", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), "png"],
		["image/jpeg", Buffer.from([255, 216, 255, 0]), "jpg"],
		["image/webp", Buffer.from("RIFF0000WEBP"), "webp"],
	])("registers owned %s uploads with a safe extension", async (mime, bytes, extension) => {
		await expect(service.upload("camper", file(mime as string, bytes as Buffer))).resolves.toEqual({
			url: "https://example.test/review.png",
		});
		expect(storage.uploadImage).toHaveBeenCalledWith(
			expect.objectContaining({ originalname: `review.${extension}` }),
			"trip-reviews"
		);
		expect(source.query).toHaveBeenCalledWith(expect.any(String), [
			expect.any(String),
			"camper",
			"https://example.test/review.png",
		]);
	});
	it.each([
		undefined,
		file("image/png", Buffer.from("fake")),
		file("image/gif", Buffer.from("GIF89a")),
	])("rejects missing or forged images", async (input) => {
		await expect(service.upload("camper", input)).rejects.toBeInstanceOf(BadRequestException);
		expect(storage.uploadImage).not.toHaveBeenCalled();
		expect(source.query).not.toHaveBeenCalled();
	});
});
