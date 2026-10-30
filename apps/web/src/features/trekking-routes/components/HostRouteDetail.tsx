import { Eye, MoreHorizontal, Pencil } from "lucide-react";
import type { CreatedTrekkingRoute } from "../types";
import { RouteMetadata } from "./RouteMetadata";
import { RouteSafetyPreview } from "./RouteSafetyPreview";
import { RouteStatusBadge } from "./RouteStatusBadge";

interface Props {
	route: CreatedTrekkingRoute;
	onEdit?: (id: string) => void;
	onDetail?: (id: string) => void;
}
export function HostRouteDetail({ route, onEdit, onDetail }: Props) {
	return (
		<section
			aria-label="Tuyến được chọn"
			className="min-w-0 rounded-2xl border border-[#e0e7e2] bg-white p-4 shadow-sm lg:p-5"
		>
			<header className="mb-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<h2 className="break-words text-xl font-extrabold text-[#10221b] sm:text-2xl">
							{route.name}
						</h2>
						<RouteStatusBadge status={route.status} />
					</div>
					<div className="flex items-center gap-2">
						{route.status === "draft" && onEdit && (
							<button
								type="button"
								onClick={() => onEdit(route.id)}
								className="flex items-center gap-2 rounded-xl bg-[#164d32] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#103b26]"
							>
								<Pencil className="size-4" />
								Chỉnh sửa
							</button>
						)}
						{onDetail && (
							<details className="relative">
								<summary
									aria-label="Tùy chọn tuyến"
									className="flex cursor-pointer list-none items-center rounded-xl border border-[#d5ded7] p-2.5"
								>
									<MoreHorizontal className="size-5" />
								</summary>
								<div className="absolute top-full right-0 z-30 mt-2 w-44 rounded-xl border border-[#e0e7e2] bg-white p-1 shadow-lg">
									<button
										type="button"
										onClick={() => onDetail(route.id)}
										className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f1f7f2]"
									>
										<Eye className="size-4" />
										Xem chi tiết
									</button>
								</div>
							</details>
						)}
					</div>
				</div>
				<div className="mt-3">
					<RouteMetadata route={route} />
				</div>
				{route.description && (
					<p className="mt-3 line-clamp-2 text-sm text-[#667a6d]">{route.description}</p>
				)}
			</header>
			<RouteSafetyPreview
				geometry={route.geometry}
				routeId={route.id}
				variant="embedded"
				showSummary
				showMapTitle={false}
				mapHeightClassName="h-[54dvh] min-h-96 max-h-[34rem]"
			/>
		</section>
	);
}
