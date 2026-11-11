import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { ContentReportStatus as Status } from "../content-report-status.enum";
import { TransitionContentReportDto } from "./transition-content-report.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: TransitionContentReportDto });

describe("TransitionContentReportDto", () => {
	const valid = { expectedStatus: Status.PENDING, status: Status.ACTIONED };
	it("accepts only the typed concurrency and requested-status fields", async () => {
		await expect(validate(valid)).resolves.toEqual(valid);
	});
	it.each([
		"reporter",
		"reporterId",
		"reporter_id",
		"targetType",
		"target_type",
		"targetId",
		"target_id",
		"reason",
		"actorId",
		"currentStatus",
		"version",
	])("rejects caller override: %s", async (field) => {
		await expect(validate({ ...valid, [field]: "override" })).rejects.toMatchObject({
			status: 422,
		});
	});
	it.each([undefined, null, "", "Pending", "unknown", 1, {}, []])(
		"rejects malformed status or expectedStatus: %p",
		async (value) => {
			await expect(validate({ ...valid, status: value })).rejects.toMatchObject({ status: 422 });
			await expect(validate({ ...valid, expectedStatus: value })).rejects.toMatchObject({
				status: 422,
			});
		}
	);
});
