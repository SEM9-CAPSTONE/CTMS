import { safetyText as t } from "../messages";
import type { LiveSafetySource, SafetyFeature } from "../types";
import { SafetyFeatureDetails } from "./SafetyFeatureDetails";

export function SafetyFeatureGroups({
	features,
	sources,
}: { features: SafetyFeature[]; sources?: LiveSafetySource[] }) {
	const providers = { area: "NCHMF", point: "VNDMS", water: "OSM" } as const;
	const groups = {
		area: features.filter(
			(f) =>
				f.properties.sourceType !== "RESOURCE" &&
				["Polygon", "MultiPolygon"].includes(f.geometry.type)
		),
		point: features.filter(
			(f) =>
				f.properties.sourceType !== "RESOURCE" &&
				!["Polygon", "MultiPolygon"].includes(f.geometry.type)
		),
		water: features.filter((f) => f.properties.sourceType === "RESOURCE"),
	};
	return (
		<div className="mt-3 grid gap-4">
			{(Object.keys(groups) as Array<keyof typeof groups>).map((key) => (
				<div key={key}>
					<h4 className="mb-2 font-bold">
						{t.groups[key]} (
						{groups[key].length === 0 &&
						sources?.some((s) => s.source === providers[key] && s.status === "LOADING")
							? "…"
							: groups[key].length}
						)
					</h4>
					{groups[key].length === 0 && (
						<p className="text-xs">
							{sources?.some((s) => s.source === providers[key] && s.status === "LOADING")
								? t.groupLoading
								: t.groupEmpty}
						</p>
					)}
					<div className="grid max-h-64 gap-2 overflow-auto">
						{groups[key].map((feature) => (
							<SafetyFeatureDetails key={feature.id} feature={feature} />
						))}
					</div>
				</div>
			))}
			<p className="text-xs">
				<a
					href="https://www.openstreetmap.org/copyright"
					target="_blank"
					rel="noreferrer"
					className="underline"
				>
					{t.waterAttribution}
				</a>
			</p>
		</div>
	);
}
