import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { Test } from "@nestjs/testing";
import { fictionalPdf } from "../../../test/support/survival-source-fixture";
import { SurvivalDocumentsController } from "./survival-documents.controller";
import { SurvivalDocumentsService } from "./survival-documents.service";

describe("SurvivalDocumentsController PDF response", () => {
	const filename = "Hướng dẫn.pdf";
	const file = jest.fn(async () => ({ bytes: fictionalPdf, filename }));
	let controller: SurvivalDocumentsController;
	let response: ServerResponse;

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [SurvivalDocumentsController],
			providers: [{ provide: SurvivalDocumentsService, useValue: { file } }],
		}).compile();
		controller = module.get(SurvivalDocumentsController);
	});

	beforeEach(() => {
		response = new ServerResponse(new IncomingMessage(new Socket()));
	});

	it("writes the original PDF and attachment headers to an open response", async () => {
		const end = jest.spyOn(response, "end");
		await controller.file("document", "version", response);
		expect(response.getHeader("Content-Type")).toBe("application/pdf");
		expect(response.getHeader("Content-Length")).toBe(fictionalPdf.length);
		expect(response.getHeader("Content-Disposition")).toBe(
			`attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`
		);
		expect(end).toHaveBeenCalledWith(fictionalPdf);
	});

	it("skips writing when the client disconnects while the PDF is loading", async () => {
		const end = jest.spyOn(response, "end");
		const pending = controller.file("document", "version", response);
		response.destroy();
		await pending;
		expect(end).not.toHaveBeenCalled();
	});
});
