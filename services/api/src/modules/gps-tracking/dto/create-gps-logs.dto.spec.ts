import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { GPS_LOG_BATCH_MAX_SIZE } from "../gps-tracking.constants";
import { CreateGpsLogsDto } from "./create-gps-logs.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: CreateGpsLogsDto });

const validLog = {
	id: "44444444-4444-4444-8444-444444444444",
	eventTime: "2026-10-12T10:00:00.000+07:00",
	latitude: 16.05,
	longitude: 108.23,
	accuracyMeters: 8,
	configVersion: "v3",
};

describe("CreateGpsLogsDto", () => {
	it("accepts a valid batch with optional context fields", async () => {
		await expect(
			validate({
				logs: [{ ...validLog, altitudeMeters: 1200, batteryLevel: 64, packageVersion: "pkg-7" }],
			})
		).resolves.toBeInstanceOf(CreateGpsLogsDto);
	});

	it.each([
		["a missing latitude (no fabricated coordinates)", { latitude: undefined }],
		["a latitude out of range", { latitude: 91 }],
		["a longitude out of range", { longitude: -181 }],
		["a negative accuracy", { accuracyMeters: -1 }],
		["a battery level above 100", { batteryLevel: 101 }],
		["an eventTime without timezone (BR-188)", { eventTime: "2026-10-12T10:00:00" }],
		["a non-UUID id", { id: "local-1" }],
		["a missing configVersion", { configVersion: undefined }],
	])("rejects %s", async (_label, override) => {
		await expect(validate({ logs: [{ ...validLog, ...override }] })).rejects.toMatchObject({
			status: 422,
		});
	});

	it("rejects an empty batch", async () => {
		await expect(validate({ logs: [] })).rejects.toMatchObject({ status: 422 });
	});

	it("rejects a batch larger than the maximum size", async () => {
		const logs = Array.from({ length: GPS_LOG_BATCH_MAX_SIZE + 1 }, () => validLog);
		await expect(validate({ logs })).rejects.toMatchObject({ status: 422 });
	});
});
