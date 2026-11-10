import { UploadsController } from "./uploads.controller";
import type { UploadsService } from "./uploads.service";

describe("UploadsController", () => {
	it("stores an evidence document (image or PDF) through uploadDocument", async () => {
		const stored = { url: "https://cdn.example/doc.pdf", key: "doc" };
		const service = {
			uploadDocument: jest.fn().mockResolvedValue(stored),
			uploadImage: jest.fn(),
		};
		const controller = new UploadsController(service as unknown as UploadsService);
		const file = { mimetype: "application/pdf" } as Express.Multer.File;

		await expect(controller.uploadDocument(file, "weather-penalty-waivers")).resolves.toBe(stored);
		expect(service.uploadDocument).toHaveBeenCalledWith(file, "weather-penalty-waivers");
		expect(service.uploadImage).not.toHaveBeenCalled();
	});
});
