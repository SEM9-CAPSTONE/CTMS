import type { DataSource } from "typeorm";
import type { UploadsService } from "../../uploads/uploads.service";
import { TripImageCleanupWorker } from "./trip-image-cleanup.worker";
describe("TripImageCleanupWorker", () => {
	const query = jest.fn();
	const uploads = { deleteStoredImage: jest.fn() };
	const db = {
		transaction: async (fn: (m: { query: typeof query }) => Promise<void>) => fn({ query }),
	};
	const worker = new TripImageCleanupWorker(db as DataSource, uploads as unknown as UploadsService);
	beforeEach(() => {
		jest.resetAllMocks();
	});
	it("deletes storage before acknowledging its durable cleanup item", async () => {
		query
			.mockResolvedValueOnce([{ id: "job", url: "url", storage_key: "trips/key" }])
			.mockResolvedValueOnce([]);
		await worker.tick();
		expect(uploads.deleteStoredImage).toHaveBeenCalledWith("url", "trips/key");
		expect(query).toHaveBeenLastCalledWith("DELETE FROM trip_image_cleanup WHERE id=$1", ["job"]);
	});
	it("retains failed storage deletions for retry", async () => {
		query
			.mockResolvedValueOnce([{ id: "job", url: "url", storage_key: null }])
			.mockResolvedValueOnce([]);
		uploads.deleteStoredImage.mockRejectedValueOnce(new Error("storage down"));
		await worker.tick();
		expect(query).toHaveBeenLastCalledWith(expect.stringContaining("attempts=attempts+1"), ["job"]);
	});
});
