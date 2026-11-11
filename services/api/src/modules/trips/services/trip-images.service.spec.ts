import {
	ConflictException,
	ForbiddenException,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import type { DataSource } from "typeorm";
import type { UploadsService } from "../../uploads/uploads.service";
import { TripImagesService } from "./trip-images.service";

const image = { id: "image", url: "https://example.test/image.png", sortOrder: 0 };
const file = {
	buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]),
	mimetype: "image/png",
} as Express.Multer.File;
describe("TripImagesService", () => {
	const query = jest.fn();
	const save = jest.fn();
	const touch = jest.fn().mockResolvedValue([]);
	const manager = {
		query: (sql: string, params: unknown[]) =>
			sql.startsWith("UPDATE trips SET updated_at=")
				? touch(sql, params)
				: sql.includes("trip_image_cleanup")
					? Promise.resolve([{ id: "receipt" }])
					: query(sql, params),
		getRepository: () => ({ save }),
	};
	const transaction = jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager));
	const uploads = {
		prepareTripImage: jest.fn(),
		uploadImage: jest.fn(),
		deleteStoredImage: jest.fn(),
	};
	const dbQuery = jest.fn();
	const db = {
		manager: { query: jest.fn(async () => [{ host_id: "host", status: "draft" }]) },
		transaction,
		query: dbQuery,
	};
	const service = new TripImagesService(
		db as unknown as DataSource,
		uploads as unknown as UploadsService
	);
	beforeEach(() => {
		jest.clearAllMocks();
		query.mockReset();
		dbQuery.mockResolvedValue([{ id: "receipt" }]);
		uploads.prepareTripImage.mockImplementation(() => ({
			url: image.url,
			key: "trips/image",
			upload: uploads.uploadImage,
		}));
		uploads.uploadImage.mockResolvedValue({ url: image.url, key: "trips/image" });
	});
	it("uploads verified bytes and sets only the first thumbnail", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([image]);
		await expect(service.add("host", "trip", file)).resolves.toEqual([image]);
		expect(uploads.uploadImage).toHaveBeenCalledTimes(1);
		expect(query).toHaveBeenCalledWith("UPDATE trips SET cover_image_url=$2 WHERE id=$1", [
			"trip",
			image.url,
		]);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: "trip.image_added" }));
		expect(touch).toHaveBeenCalledWith(expect.stringContaining("interval '1 millisecond'"), [
			"trip",
		]);
	});
	it("keeps the thumbnail when adding a subsequent image", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "published" }])
			.mockResolvedValueOnce([image])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([image]);
		await service.add("host", "trip", file);
		expect(query.mock.calls.some(([sql]) => sql.startsWith("UPDATE trips"))).toBe(false);
	});
	it("returns identical content without uploading twice, even at the limit", async () => {
		const images = Array.from({ length: 5 }, (_, i) => ({ ...image, id: String(i), sortOrder: i }));
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce(images)
			.mockResolvedValueOnce([{ id: "image" }]);
		await expect(service.add("host", "trip", file)).resolves.toEqual(images);
		expect(uploads.uploadImage).not.toHaveBeenCalled();
		expect(touch).not.toHaveBeenCalled();
	});
	it("rejects the sixth image before writing storage", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce(Array(5).fill(image))
			.mockResolvedValueOnce([]);
		await expect(service.add("host", "trip", file)).rejects.toBeInstanceOf(ConflictException);
		expect(uploads.uploadImage).not.toHaveBeenCalled();
	});
	it.each(["pending_approval", "ongoing", "completed", "cancelled"])(
		"protects %s Trips",
		async (status) => {
			query.mockResolvedValueOnce([{ host_id: "host", status }]);
			await expect(service.add("host", "trip", file)).rejects.toBeInstanceOf(ConflictException);
			expect(uploads.uploadImage).not.toHaveBeenCalled();
		}
	);
	it("rejects unrelated Hosts", async () => {
		query.mockResolvedValueOnce([{ host_id: "other", status: "draft" }]);
		await expect(service.remove("host", "trip", "image")).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(query).toHaveBeenCalledTimes(1);
	});
	it("rejects a missing Trip", async () => {
		query.mockResolvedValueOnce([]);
		await expect(service.add("host", "missing", file)).rejects.toBeInstanceOf(NotFoundException);
	});
	it("rejects fake image bytes", async () => {
		await expect(
			service.add("host", "trip", { ...file, buffer: Buffer.from("not an image") })
		).rejects.toBeInstanceOf(UnprocessableEntityException);
		expect(transaction).not.toHaveBeenCalled();
	});
	it("rejects oversized images", async () => {
		const buffer = Buffer.concat([file.buffer, Buffer.alloc(5 * 1024 * 1024)]);
		await expect(service.add("host", "trip", { ...file, buffer })).rejects.toBeInstanceOf(
			UnprocessableEntityException
		);
	});
	it("does not insert metadata if storage fails", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
		uploads.uploadImage.mockRejectedValueOnce(new Error("storage down"));
		await expect(service.add("host", "trip", file)).rejects.toThrow("storage down");
		expect(save).not.toHaveBeenCalled();
	});
	it("queues orphan cleanup when metadata fails", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockRejectedValueOnce(new Error("insert failed"))
			.mockResolvedValueOnce([]);
		await expect(service.add("host", "trip", file)).rejects.toThrow("insert failed");
		expect(dbQuery).toHaveBeenLastCalledWith(
			"UPDATE trip_image_cleanup SET next_attempt_at=now() WHERE id=$1",
			["receipt"]
		);
	});
	it("removes only this Trip's image and audits the removal", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce([{ id: "image" }])
			.mockResolvedValueOnce([]);
		await expect(service.remove("host", "trip", "image")).resolves.toEqual([]);
		expect(query).toHaveBeenCalledWith(
			"WITH removed AS (DELETE FROM trip_images WHERE trip_id=$1 AND id=$2 RETURNING id) SELECT id FROM removed",
			["trip", "image"]
		);
		expect(save).toHaveBeenCalledWith(expect.objectContaining({ action: "trip.image_removed" }));
	});
	it("safely accepts a repeated removal", async () => {
		query
			.mockResolvedValueOnce([{ host_id: "host", status: "draft" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([]);
		await expect(service.remove("host", "trip", "image")).resolves.toEqual([]);
		expect(save).not.toHaveBeenCalled();
	});
});
