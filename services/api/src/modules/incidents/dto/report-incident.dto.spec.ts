import { UnprocessableEntityException, ValidationPipe } from "@nestjs/common";
import { validationExceptionFactory } from "../../../shared/pipes/validation-exception-factory";
import { INCIDENT_DESCRIPTION_MAX_LENGTH } from "../incidents.constants";
import { ReportIncidentDto } from "./report-incident.dto";

const pipe = new ValidationPipe({
	whitelist: true,
	forbidNonWhitelisted: true,
	transform: true,
	exceptionFactory: validationExceptionFactory,
});
const validate = (body: unknown) =>
	pipe.transform(body, { type: "body", metatype: ReportIncidentDto });

const validReport = {
	id: "66666666-6666-4666-8666-666666666666",
	category: "injury",
	severity: "high",
	description: "  Camper twisted an ankle  ",
	occurredAt: "2026-10-12T11:30:00.000+07:00",
	location: {
		latitude: 16.05,
		longitude: 108.23,
		accuracyMeters: 12,
		capturedAt: "2026-10-12T11:31:00.000+07:00",
	},
	capturedOffline: true,
};

describe("ReportIncidentDto (BR-161 / BR-205)", () => {
	it("accepts a complete report and trims the description", async () => {
		const dto = (await validate(validReport)) as ReportIncidentDto;
		expect(dto).toBeInstanceOf(ReportIncidentDto);
		expect(dto.description).toBe("Camper twisted an ankle");
	});

	it.each([
		["no location (unavailable fix)", { location: undefined }],
		["a null location", { location: null }],
		["no capturedOffline flag", { capturedOffline: undefined }],
	])("accepts %s", async (_label, overrides) => {
		await expect(validate({ ...validReport, ...overrides })).resolves.toBeInstanceOf(
			ReportIncidentDto
		);
	});

	it.each([
		["a non-UUID id", { id: "local-1" }],
		["an unknown category", { category: "sos" }],
		["an unknown severity", { severity: "urgent" }],
		["a blank description", { description: "   " }],
		["a too long description", { description: "x".repeat(INCIDENT_DESCRIPTION_MAX_LENGTH + 1) }],
		["an occurredAt without timezone (BR-188)", { occurredAt: "2026-10-12T11:30:00" }],
		["a latitude out of range", { location: { ...validReport.location, latitude: 91 } }],
		["a partial location", { location: { latitude: 16.05, longitude: 108.23 } }],
		["a negative accuracy", { location: { ...validReport.location, accuracyMeters: -1 } }],
		["an unknown field", { status: "resolved" }],
	])("rejects %s with 422", async (_label, overrides) => {
		await expect(validate({ ...validReport, ...overrides })).rejects.toBeInstanceOf(
			UnprocessableEntityException
		);
	});
});
