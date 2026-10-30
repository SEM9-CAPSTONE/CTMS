import {
	ArrowLeft,
	Clock3,
	FileText,
	Footprints,
	Loader2,
	Mountain,
	Pencil,
	RefreshCw,
	Route,
	Spline,
} from "lucide-react";
import { RouteSafetyPreview } from "../components/RouteSafetyPreview";
import { RouteStatusActionDialog } from "../components/RouteStatusActionDialog";
import { difficultyLabels, formatLength, statusLabels } from "../components/TrekkingRouteList";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";

export interface TrekkingRouteDetailPageProps {
	routeId: string;
	onBack: () => void;
	onEdit: (routeId: string) => void;
}

export function TrekkingRouteDetailPage({ routeId, onBack, onEdit }: TrekkingRouteDetailPageProps) {
	const routes = useTrekkingRoutes();
	const route = routes.items.find((item) => item.id === routeId);

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
					<button
						type="button"
						aria-label="Quay về danh sách tuyến"
						onClick={onBack}
						className="rounded-xl border p-2.5"
					>
						<ArrowLeft className="size-5" />
					</button>
					<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
						<Route className="size-6" />
					</div>
					<div className="min-w-0 flex-1">
						<h1 className="truncate text-xl font-extrabold sm:text-2xl">
							{route?.name ?? "Chi tiết tuyến trekking"}
						</h1>
					</div>
					{route?.status === "draft" && (
						<button
							type="button"
							onClick={() => onEdit(route.id)}
							className="flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 font-bold text-white"
						>
							<Pencil className="size-4" />
							Chỉnh sửa
						</button>
					)}
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
				{routes.isLoading && (
					<div className="flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold">
						<Loader2 className="size-4 animate-spin" />
						Đang tải tuyến đường...
					</div>
				)}

				{routes.error && !routes.isLoading && (
					<div
						role="alert"
						className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"
					>
						{routes.error}
						<button
							type="button"
							onClick={() => void routes.retry()}
							className="mt-4 block rounded-lg border px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Tải lại
						</button>
					</div>
				)}

				{!routes.isLoading && !routes.error && !route && (
					<div className="rounded-2xl border border-dashed bg-white p-8 text-center font-extrabold">
						Không tìm thấy tuyến đường.
					</div>
				)}

				{route && (
					<>
						<section className="rounded-3xl border border-[#e0ebe0] bg-white p-5 shadow-sm sm:p-6">
							<div className="flex items-center gap-3">
								<span className="flex size-10 items-center justify-center rounded-full bg-[#eef4ee] text-[#164027]">
									<Footprints className="size-5" aria-hidden="true" />
								</span>
								<h2 className="text-xl font-extrabold">Thông tin tuyến</h2>
							</div>
							<dl className="mt-5 grid grid-cols-2 gap-y-5 lg:grid-cols-4 lg:divide-x lg:divide-[#e0ebe0]">
								{[
									{
										icon: Mountain,
										label: "Độ khó",
										value: difficultyLabels[route.difficulty],
									},
									{
										icon: Clock3,
										label: "Thời lượng dự kiến",
										value: `${route.expectedDurationMinutes} phút`,
									},
									{ icon: Spline, label: "Chiều dài", value: formatLength(route.lengthMeters) },
								].map(({ icon: Icon, label, value }) => (
									<div key={label} className="flex gap-3 px-2 lg:px-6 lg:first:pl-2">
										<Icon className="mt-0.5 size-5 shrink-0 text-[#34483b]" aria-hidden="true" />
										<div>
											<dt className="text-sm text-[#667a6d]">{label}</dt>
											<dd className="mt-1 text-base font-extrabold">{value}</dd>
										</div>
									</div>
								))}
								<div className="flex gap-3 px-2 lg:px-6">
									<FileText className="mt-0.5 size-5 shrink-0 text-[#34483b]" aria-hidden="true" />
									<div>
										<dt className="text-sm text-[#667a6d]">Trạng thái</dt>
										<dd className="mt-1">
											<span className="inline-block rounded-full bg-[#eceeec] px-3 py-1 text-xs font-bold text-[#52675a]">
												{statusLabels[route.status]}
											</span>
										</dd>
									</div>
								</div>
							</dl>
							{route.description && (
								<p className="mt-5 whitespace-pre-line text-sm text-[#52675a]">
									{route.description}
								</p>
							)}
							<div className="mt-5 border-t border-[#e0ebe0] pt-5">
								<RouteSafetyPreview
									variant="embedded"
									geometry={route.geometry}
									routeId={route.id}
								/>
							</div>
						</section>

						<RouteStatusActionDialog route={route} onReload={routes.retry} />
					</>
				)}
			</main>
		</div>
	);
}
