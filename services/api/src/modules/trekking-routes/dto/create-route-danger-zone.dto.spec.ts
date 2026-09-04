import { plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";
import { RouteDangerZoneSeverity } from "../entities/route-danger-zone.entity";
import { CreateRouteDangerZoneDto } from "./create-route-danger-zone.dto";

function validPointPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		geometry: { type: "Point", coordinates: [108.458313, 11.940419] },
		radiusMeters: 50,
		description: "  Falling-rock area  ",
		severity: RouteDangerZoneSeverity.MEDIUM,
		...overrides,
	};
}

function validPolygonPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		geometry: {
			type: "Polygon",
			coordinates: [
				[
					[108.45, 11.94],
					[108.46, 11.94],
					[108.46, 11.95],
					[108.45, 11.94],
				],
			],
		},
		description: "  Landslide area  ",
		severity: RouteDangerZoneSeverity.HIGH,
		...overrides,
	};
}

async function validationErrors(payload: Record<string, unknown>) {
	const dto = plainToInstance(CreateRouteDangerZoneDto, payload);
	return {
		dto,
		errors: await validate(dto, { whitelist: true, forbidNonWhitelisted: true }),
	};
}

function allProperties(errors: ValidationError[]): string[] {
	return errors.flatMap((error) => [error.property, ...allProperties(error.children ?? [])]);
}

describe("CreateRouteDangerZoneDto", () => {
	it("accepts a Point with positive finite radius and trims its description", async () => {
		const { dto, errors } = await validationErrors(validPointPayload());
		expect(errors).toEqual([]);
		expect(dto.description).toBe("Falling-rock area");
		expect(dto.radiusMeters).toBe(50);
	});

	it("accepts a closed Polygon without radius", async () => {
		const { dto, errors } = await validationErrors(validPolygonPayload());
		expect(errors).toEqual([]);
		expect(dto.description).toBe("Landslide area");
		expect(dto.radiusMeters).toBeUndefined();
	});

	it.each([undefined, 0, -1, Number.POSITIVE_INFINITY, Number.NaN])(
		"rejects Point radius %s",
		async (radiusMeters) => {
			const payload = validPointPayload({ radiusMeters });
			expect(allProperties((await validationErrors(payload)).errors)).toContain("radiusMeters");
		}
	);

	it("rejects radiusMeters for Polygon geometry", async () => {
		expect(
			allProperties((await validationErrors(validPolygonPayload({ radiusMeters: 10 }))).errors)
		).toContain("radiusMeters");
	});

	it.each([
		undefined,
		null,
		{},
		{ type: "LineString", coordinates: [[108.45, 11.94]] },
		{ type: "MultiPolygon", coordinates: [] },
		{ type: "Point", coordinates: [108.45] },
		{ type: "Point", coordinates: [181, 11.94] },
		{ type: "Point", coordinates: [108.45, -91] },
		{ type: "Point", coordinates: [Number.POSITIVE_INFINITY, 11.94] },
		{ type: "Point", coordinates: [108.45, 11.94], routeId: "server-field" },
		{ type: "Polygon", coordinates: [] },
		{
			type: "Polygon",
			coordinates: [
				[
					[108.45, 11.94],
					[108.46, 11.94],
					[108.46, 11.95],
					[108.45, 11.95],
				],
			],
		},
		{
			type: "Polygon",
			coordinates: [
				[
					[108.45, 11.94],
					[181, 11.94],
					[108.46, 11.95],
					[108.45, 11.94],
				],
			],
		},
	])("rejects malformed or unsupported geometry %#", async (geometry) => {
		const payload = validPointPayload({ geometry });
		expect(allProperties((await validationErrors(payload)).errors)).toContain("geometry");
	});

	it.each(["   ", "d".repeat(1001)])("rejects invalid description", async (description) => {
		expect(
			allProperties((await validationErrors(validPointPayload({ description }))).errors)
		).toContain("description");
	});

	it("accepts a description exactly 1000 characters long", async () => {
		expect(
			(await validationErrors(validPointPayload({ description: "d".repeat(1000) }))).errors
		).toEqual([]);
	});

	it("accepts exactly low, medium, and high severity", async () => {
		for (const severity of Object.values(RouteDangerZoneSeverity)) {
			expect((await validationErrors(validPointPayload({ severity }))).errors).toEqual([]);
		}
		expect(
			allProperties((await validationErrors(validPointPayload({ severity: "critical" }))).errors)
		).toContain("severity");
	});

	it("rejects server-controlled and unexpected fields", async () => {
		const { errors } = await validationErrors(
			validPointPayload({
				id: "danger-zone-id",
				routeId: "route-id",
				hostId: "host-id",
				createdAt: "now",
				updatedAt: "now",
				status: "active",
			})
		);
		expect(allProperties(errors)).toEqual(
			expect.arrayContaining(["id", "routeId", "hostId", "createdAt", "updatedAt", "status"])
		);
	});
});
