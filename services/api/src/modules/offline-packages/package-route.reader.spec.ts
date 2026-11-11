import { unzipSync, zipSync } from "fflate";
import { recoveryFixture } from "../../../test/support/route-recovery-fixture";
import { PackageFailure } from "./offline-packages.types";
import { PackageArtifactBuilder } from "./package-artifact.builder";
import { canonical, digest } from "./package-policy";
import { readVerifiedPackageRoute } from "./package-route.reader";

describe("CTMS-315 verified package route parser", () => {
	it("preserves verified route order and longitude/latitude", () => {
		const fixture = recoveryFixture();
		new PackageArtifactBuilder().verify(fixture.bytes, fixture.manifest);
		expect(readVerifiedPackageRoute(fixture.bytes, fixture.metadata)).toEqual(fixture.geometry);
	});
	it.each(["trip", "version", "route", "fingerprint"])(
		"rejects conflicting %s identity",
		(identity) => {
			const fixture = recoveryFixture();
			if (identity === "trip") fixture.metadata.trip_id = "other";
			if (identity === "version") fixture.metadata.package_version++;
			if (identity === "route") fixture.metadata.manifest.route.routeId = "other";
			if (identity === "fingerprint") fixture.metadata.manifest.route.fingerprint = "0".repeat(64);
			expect(() => readVerifiedPackageRoute(fixture.bytes, fixture.metadata)).toThrow(
				PackageFailure
			);
		}
	);
	it.each([
		"not-json",
		JSON.stringify({
			type: "Feature",
			properties: {},
			geometry: { type: "Point", coordinates: [108, 16] },
		}),
		JSON.stringify({
			type: "Feature",
			properties: {},
			geometry: {
				type: "LineString",
				coordinates: [
					[181, 16],
					[108, 16],
				],
			},
		}),
		JSON.stringify({
			type: "Feature",
			properties: {},
			geometry: { type: "LineString", coordinates: [[108, 16]] },
		}),
	])("rejects malformed route even with valid archive payload digests (%#)", (route) => {
		const fixture = recoveryFixture();
		const files = unzipSync(fixture.bytes);
		files["route.geojson"] = Buffer.from(route);
		const entry = fixture.manifest.files.find((file) => file.path === "route.geojson");
		if (!entry) throw new Error("Fixture route missing");
		entry.sha256 = digest(Buffer.from(route));
		entry.sizeBytes = Buffer.byteLength(route);
		files["manifest.json"] = Buffer.from(canonical(fixture.manifest));
		const bytes = Buffer.from(zipSync(files));
		new PackageArtifactBuilder().verify(bytes, fixture.manifest);
		expect(() => readVerifiedPackageRoute(bytes, fixture.metadata)).toThrow(PackageFailure);
	});
});
