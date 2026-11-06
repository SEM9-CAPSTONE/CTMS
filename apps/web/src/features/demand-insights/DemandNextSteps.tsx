import { RoutePath } from "../../routes/routes.config";
import { panelClass } from "./constants";

export const demandDestinations = {
	mine: `${RoutePath.HOST_CAMPERS}?from=demand-insights`,
	explore: RoutePath.TRIPS,
} as const;

export function DemandNextSteps({ limited = false }: { limited?: boolean }) {
	const linkClass =
		"inline-flex w-full justify-center sm:w-auto rounded-xl border border-[#b5c8b8] bg-white px-4 py-2.5 text-sm font-semibold text-[#164027] hover:bg-[#eaf1e6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027]";
	return (
		<section className={panelClass} aria-label="Tiếp theo">
			<h2 className="font-bold">Tiếp theo</h2>

			<div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-6">
				{!limited && (
					<div>
						<a href={demandDestinations.mine} className={linkClass}>
							Xem người tham gia & đặt chỗ
						</a>
						<p className="mt-2 text-xs leading-5 text-[#526357]">
							Quản lý người tham gia và đơn đặt chỗ theo chuyến
						</p>
					</div>
				)}
				<div>
					<a href={demandDestinations.explore} className={linkClass}>
						Khám phá chuyến đi
					</a>
					<p className="mt-2 text-xs leading-5 text-[#526357]">Chuyến công khai đang mở hiện nay</p>
				</div>
			</div>
		</section>
	);
}
