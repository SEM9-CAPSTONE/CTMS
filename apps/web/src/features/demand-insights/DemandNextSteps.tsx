import { ArrowRight, Compass, Users } from "lucide-react";
import type React from "react";
import { demandDestinations, panelClass } from "./constants";

export function DemandNextSteps({ limited = false }: { limited?: boolean }) {
	const handleNavigate = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
		if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
			e.preventDefault();
			window.history.pushState({}, "", path);
			window.dispatchEvent(new PopStateEvent("popstate"));
		}
	};

	return (
		<section className={panelClass} aria-label="Tiếp theo">
			<h2 className="font-bold">Tiếp theo</h2>

			<div className={`mt-4 grid gap-4 ${limited ? "max-w-md" : "sm:grid-cols-2"}`}>
				{!limited && (
					<div className="group relative flex items-center justify-between gap-3 rounded-xl border border-[#dfe8df] bg-[#f4f7f2] p-4 transition-colors hover:border-[#b5c8b8] hover:bg-[#ebf3ea]">
						<div className="flex items-center gap-3.5">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#164027]">
								<Users className="size-5" aria-hidden="true" />
							</div>
							<div>
								<a
									href={demandDestinations.mine}
									onClick={(e) => handleNavigate(e, demandDestinations.mine)}
									className="font-semibold text-sm text-[#164027] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027] after:absolute after:inset-0 after:cursor-pointer"
								>
									Xem người tham gia & đặt chỗ
								</a>
								<p className="mt-0.5 text-xs text-[#526357]">
									Quản lý người tham gia và đơn đặt chỗ theo chuyến
								</p>
							</div>
						</div>
						<ArrowRight
							className="size-4 shrink-0 text-[#526357] transition-transform group-hover:translate-x-0.5"
							aria-hidden="true"
						/>
					</div>
				)}
				<div className="group relative flex items-center justify-between gap-3 rounded-xl border border-[#dfe8df] bg-[#f4f7f2] p-4 transition-colors hover:border-[#b5c8b8] hover:bg-[#ebf3ea]">
					<div className="flex items-center gap-3.5">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[#164027]">
							<Compass className="size-5" aria-hidden="true" />
						</div>
						<div>
							<a
								href={demandDestinations.explore}
								onClick={(e) => handleNavigate(e, demandDestinations.explore)}
								className="font-semibold text-sm text-[#164027] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#164027] after:absolute after:inset-0 after:cursor-pointer"
							>
								Khám phá chuyến đi
							</a>
							<p className="mt-0.5 text-xs text-[#526357]">Chuyến công khai đang mở hiện nay</p>
						</div>
					</div>
					<ArrowRight
						className="size-4 shrink-0 text-[#526357] transition-transform group-hover:translate-x-0.5"
						aria-hidden="true"
					/>
				</div>
			</div>
		</section>
	);
}
