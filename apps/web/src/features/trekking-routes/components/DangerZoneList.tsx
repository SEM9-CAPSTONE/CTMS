import type { RouteDangerZone, RouteDangerZoneSeverity } from "../types";

const severityLabels: Record<RouteDangerZoneSeverity, string> = {
	low: "Thấp",
	medium: "Trung bình",
	high: "Cao",
};

const severityClasses: Record<RouteDangerZoneSeverity, string> = {
	low: "bg-yellow-100 text-yellow-900",
	medium: "bg-orange-100 text-orange-900",
	high: "bg-red-100 text-red-900",
};

export function DangerZoneList({ items }: { items: RouteDangerZone[] }) {
	if (items.length === 0) {
		return (
			<p
				data-testid="danger-zones-empty"
				className="mt-4 rounded-xl border border-dashed p-4 text-sm text-[#667a6d]"
			>
				Tuyến này chưa có khu vực nguy hiểm.
			</p>
		);
	}

	return (
		<ul className="mt-4 grid gap-3" aria-label="Danh sách khu vực nguy hiểm">
			{items.map((item) => (
				<li key={item.id} className="rounded-xl border border-[#e0ebe0] bg-[#fffaf5] p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<strong>
							{item.geometry.type === "Point"
								? "Vùng nguy hiểm dạng điểm"
								: "Vùng nguy hiểm đa giác"}
						</strong>
						<span
							className={`rounded-full px-2.5 py-1 text-xs font-bold ${severityClasses[item.severity]}`}
						>
							Mức độ {severityLabels[item.severity]}
						</span>
					</div>
					<p className="mt-2 text-sm text-[#52675a]">{item.description}</p>
					<p className="mt-2 text-xs font-bold text-[#667a6d]">
						{item.geometry.type === "Point"
							? `Bán kính ${item.radiusMeters} m`
							: "Ranh giới đa giác"}
					</p>
				</li>
			))}
		</ul>
	);
}
