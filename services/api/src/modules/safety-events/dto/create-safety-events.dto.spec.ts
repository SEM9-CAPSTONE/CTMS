import { ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { SAFETY_EVENT_BATCH_MAX_SIZE } from "../safety-events.constants";
import { SafetyEventType } from "../safety-events.enums";
import { CreateSafetyEventsDto } from "./create-safety-events.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: CreateSafetyEventsDto });

const offRoute = {
	id: "44444444-4444-4444-8444-444444444444",
	eventType: SafetyEventType.OFF_ROUTE,
	eventTime: "2026-10-26T10:00:00.000+07:00",
	latitude: 16.05,
	longitude: 108.23,
	accuracyMeters: 8,
	distanceToRouteMeters: 65,
	consecutiveValidSamples: 3,
	detectedOffline: true,
	routeVersion: "0123456789abcdef0123456789abcdef",
	configVersion: "v3",
};

const degraded = {
	id: "55555555-5555-4555-8555-555555555555",
	eventType: SafetyEventType.GPS_DEGRADED,
	eventTime: "2026-10-26T10:02:00.000+07:00",
	noValidSampleSince: "2026-10-26T10:00:00.000+07:00",
	detectedOffline: false,
	routeVersion: "0123456789abcdef0123456789abcdef",
	configVersion: "v3",
};

describe("CreateSafetyEventsDto", () => {
	it("accepts OFF_ROUTE with its sample and GPS_DEGRADED without a location", async () => {
		await expect(
			validate({ events: [{ ...offRoute, packageVersion: "pkg-7" }, degraded] })
		).resolves.toBeInstanceOf(CreateSafetyEventsDto);
	});

	it.each([
		["OFF_ROUTE without its confirming sample", { latitude: undefined }],
		["OFF_ROUTE without distance to Route", { distanceToRouteMeters: undefined }],
		["OFF_ROUTE without the consecutive sample count", { consecutiveValidSamples: undefined }],
		["a negative distance", { distanceToRouteMeters: -1 }],
		["an unknown event type", { eventType: "CHECKPOINT_REACHED" }],
		["an eventTime without timezone (BR-188)", { eventTime: "2026-10-26T10:00:00" }],
		["a missing routeVersion", { routeVersion: undefined }],
		["a configuration other than the fixed V3 one", { configVersion: "v4" }],
		["a missing detectedOffline flag", { detectedOffline: undefined }],
	])("rejects %s", async (_label, override) => {
		await expect(validate({ events: [{ ...offRoute, ...override }] })).rejects.toMatchObject({
			status: 422,
		});
	});

	it.each([
		["GPS_DEGRADED without noValidSampleSince", { noValidSampleSince: undefined }],
		["GPS_DEGRADED with a partial last known location", { latitude: 16.05 }],
	])("rejects %s", async (_label, override) => {
		await expect(validate({ events: [{ ...degraded, ...override }] })).rejects.toMatchObject({
			status: 422,
		});
	});

	it("rejects an empty batch and one larger than the maximum", async () => {
		await expect(validate({ events: [] })).rejects.toMatchObject({ status: 422 });
		await expect(
			validate({ events: Array.from({ length: SAFETY_EVENT_BATCH_MAX_SIZE + 1 }, () => offRoute) })
		).rejects.toMatchObject({ status: 422 });
	});
});
