import { UserRole } from "../users/entities/user.entity";
import type { SyncEvaluationReportResponseDto } from "./dto/sync-evaluation.dto";
import { SyncEvaluationController } from "./sync-evaluation.controller";
import { SyncEvaluationStatus } from "./sync-evaluation.enums";
import type { SyncEvaluationService } from "./sync-evaluation.service";

describe("SyncEvaluationController (CTMS-097)", () => {
	let controller: SyncEvaluationController;
	let service: jest.Mocked<SyncEvaluationService>;

	beforeEach(() => {
		service = {
			runEvaluation: jest.fn(),
			getLatestReport: jest.fn(),
			getHistory: jest.fn(),
			getReportById: jest.fn(),
		} as unknown as jest.Mocked<SyncEvaluationService>;

		controller = new SyncEvaluationController(service);
	});

	it("delegates runEvaluation to SyncEvaluationService with admin user ID", async () => {
		const expectedReport = {
			id: "report-123",
			overallResult: SyncEvaluationStatus.PASSED,
		} as SyncEvaluationReportResponseDto;
		service.runEvaluation.mockResolvedValue(expectedReport);

		const request = {
			user: {
				userId: "admin-uuid",
				email: "admin@example.com",
				roles: [UserRole.ADMIN],
			},
		};

		const dto = { datasetVersion: "v3.0.0-offline-sync" };
		const result = await controller.runEvaluation(request, dto);

		expect(service.runEvaluation).toHaveBeenCalledWith("admin-uuid", dto);
		expect(result).toBe(expectedReport);
	});

	it("delegates getLatest, getHistory and getReportById", async () => {
		const expectedReport = {
			id: "report-123",
			overallResult: SyncEvaluationStatus.PASSED,
		} as SyncEvaluationReportResponseDto;

		service.getLatestReport.mockResolvedValue(expectedReport);
		service.getHistory.mockResolvedValue([expectedReport]);
		service.getReportById.mockResolvedValue(expectedReport);

		expect(await controller.getLatest()).toBe(expectedReport);
		expect(await controller.getHistory("10")).toEqual([expectedReport]);
		expect(service.getHistory).toHaveBeenCalledWith(10);
		expect(await controller.getReportById("report-123")).toBe(expectedReport);
		expect(service.getReportById).toHaveBeenCalledWith("report-123");
	});
});
