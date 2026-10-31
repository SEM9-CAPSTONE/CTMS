import { UserRole } from "../users/entities/user.entity";
import type { OverbookingEvaluationReportResponseDto } from "./dto/overbooking-evaluation.dto";
import { OverbookingEvaluationController } from "./overbooking-evaluation.controller";
import { OverbookingEvaluationStatus } from "./overbooking-evaluation.enums";
import type { OverbookingEvaluationService } from "./overbooking-evaluation.service";

describe("OverbookingEvaluationController (CTMS-095)", () => {
	let controller: OverbookingEvaluationController;
	let service: jest.Mocked<OverbookingEvaluationService>;

	beforeEach(() => {
		service = {
			runEvaluation: jest.fn(),
			getLatestReport: jest.fn(),
			getHistory: jest.fn(),
			getReportById: jest.fn(),
		} as unknown as jest.Mocked<OverbookingEvaluationService>;

		controller = new OverbookingEvaluationController(service);
	});

	it("delegates runEvaluation to OverbookingEvaluationService with admin user ID", async () => {
		const expectedReport = {
			id: "report-uuid-1",
			overallResult: OverbookingEvaluationStatus.PASSED,
		} as OverbookingEvaluationReportResponseDto;
		service.runEvaluation.mockResolvedValue(expectedReport);

		const request = {
			user: {
				userId: "admin-uuid",
				email: "admin@ctms.dev",
				roles: [UserRole.ADMIN],
			},
		};

		const dto = { datasetVersion: "v3.0.0-overbooking-prevention" };
		const result = await controller.runEvaluation(request, dto);

		expect(service.runEvaluation).toHaveBeenCalledWith("admin-uuid", dto);
		expect(result).toBe(expectedReport);
	});

	it("delegates getLatest, getHistory and getReportById", async () => {
		const expectedReport = {
			id: "report-uuid-1",
			overallResult: OverbookingEvaluationStatus.PASSED,
		} as OverbookingEvaluationReportResponseDto;

		service.getLatestReport.mockResolvedValue(expectedReport);
		service.getHistory.mockResolvedValue([expectedReport]);
		service.getReportById.mockResolvedValue(expectedReport);

		expect(await controller.getLatest()).toBe(expectedReport);
		expect(await controller.getHistory("15")).toEqual([expectedReport]);
		expect(service.getHistory).toHaveBeenCalledWith(15);
		expect(await controller.getReportById("report-uuid-1")).toBe(expectedReport);
		expect(service.getReportById).toHaveBeenCalledWith("report-uuid-1");
	});
});
