import { ArrowLeft, Eye, Loader2, RefreshCw, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RouteGeometryPreview } from "../components/RouteGeometryPreview";
import { TrekkingRouteList } from "../components/TrekkingRouteList";
import { useRouteCheckpoints } from "../hooks/useRouteCheckpoints";
import { useRouteDangerZones } from "../hooks/useRouteDangerZones";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";

export interface TrekkingRoutesPageProps {
	onBackHome?: () => void;
	onViewRouteDetail?: (routeId: string) => void;
}

export function TrekkingRoutesPage({ onBackHome, onViewRouteDetail }: TrekkingRoutesPageProps) {
	const routes = useTrekkingRoutes();
	const [selectedRouteId, setSelectedRouteId] = useState<string>();

	useEffect(() => {
		setSelectedRouteId((current) =>
			current && routes.items.some((route) => route.id === current) ? current : routes.items[0]?.id
		);
	}, [routes.items]);

	const selectedRoute = useMemo(
		() => routes.items.find((route) => route.id === selectedRouteId),
		[routes.items, selectedRouteId]
	);
	const checkpoints = useRouteCheckpoints(selectedRoute?.id);
	const dangerZones = useRouteDangerZones(selectedRoute?.id);

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBackHome && (
						<button
							type="button"
							aria-label="Quay về Host Dashboard"
							onClick={onBackHome}
							className="rounded-xl border p-2.5"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}

					<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
						<Route className="size-6" />
					</div>

					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">Tuyến trekking của Host</h1>
						<p className="text-sm text-[#667a6d]">
							Chọn một tuyến để xem trước đường đi, mở chi tiết để chỉnh sửa hoặc gửi duyệt.
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
				{routes.isLoading && (
					<div
						data-testid="routes-loading"
						className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold"
					>
						<Loader2 className="size-4 animate-spin" />
						Đang tải tuyến đường...
					</div>
				)}

				{routes.error && !routes.isLoading && (
					<div
						role="alert"
						className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800"
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

				{!routes.isLoading && !routes.error && routes.items.length === 0 && (
					<div
						data-testid="routes-empty"
						className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center"
					>
						<Route className="mx-auto size-10 text-[#8fa096]" />
						<p className="mt-3 font-extrabold">Bạn chưa có tuyến trekking</p>
					</div>
				)}

				{!routes.isLoading && !routes.error && routes.items.length > 0 && (
					<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
						<TrekkingRouteList
							items={routes.items}
							selectedRouteId={selectedRouteId}
							onSelect={(route) => setSelectedRouteId(route.id)}
						/>

						{selectedRoute && (
							<div className="lg:sticky lg:top-6 lg:self-start">
								<RouteGeometryPreview
									geometry={selectedRoute.geometry}
									checkpoints={checkpoints.items}
									dangerZones={dangerZones.items}
									footer={
										onViewRouteDetail && (
											<div className="mt-4 flex justify-end">
												<button
													type="button"
													onClick={() => onViewRouteDetail(selectedRoute.id)}
													className="flex items-center gap-2 rounded-xl bg-[#164027] px-5 py-2.5 font-bold text-white"
												>
													<Eye className="size-4" />
													Chi tiết
												</button>
											</div>
										)
									}
								/>
							</div>
						)}
					</div>
				)}
			</main>
		</div>
	);
}
