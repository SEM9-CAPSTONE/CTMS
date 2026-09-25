import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, Route } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RouteDraftWorkspace } from "../components/RouteDraftWorkspace";
import { RouteGeometryPreview } from "../components/RouteGeometryPreview";
import { RouteRegistrationBlockPanel } from "../components/RouteRegistrationBlockPanel";
import { RouteStatusActionDialog } from "../components/RouteStatusActionDialog";
import { RouteWeatherAdvicePanel } from "../components/RouteWeatherAdvicePanel";
import { RouteWeatherPanel } from "../components/RouteWeatherPanel";
import { RouteWeatherRiskPanel } from "../components/RouteWeatherRiskPanel";
import { TrekkingRouteList } from "../components/TrekkingRouteList";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";
import type { RouteCheckpoint, RouteDangerZone } from "../types";

export interface TrekkingRoutesPageProps {
	onBackHome?: () => void;
}

export function TrekkingRoutesPage({ onBackHome }: TrekkingRoutesPageProps) {
	const routes = useTrekkingRoutes();
	const [selectedRouteId, setSelectedRouteId] = useState<string>();
	const [submittedRouteName, setSubmittedRouteName] = useState("");
	const [previewCheckpoints, setPreviewCheckpoints] = useState<RouteCheckpoint[]>([]);
	const [previewDangerZones, setPreviewDangerZones] = useState<RouteDangerZone[]>([]);
	const updatePreviewCheckpoints = useCallback((checkpoints: RouteCheckpoint[]) => {
		setPreviewCheckpoints(checkpoints);
	}, []);
	const updatePreviewDangerZones = useCallback((dangerZones: RouteDangerZone[]) => {
		setPreviewDangerZones(dangerZones);
	}, []);

	useEffect(() => {
		setSelectedRouteId((current) =>
			current && routes.items.some((route) => route.id === current) ? current : routes.items[0]?.id
		);
	}, [routes.items]);

	const selectedRoute = useMemo(
		() => routes.items.find((route) => route.id === selectedRouteId),
		[routes.items, selectedRouteId]
	);
	const selectedPreviewCheckpoints = useMemo(
		() => previewCheckpoints.filter((checkpoint) => checkpoint.routeId === selectedRoute?.id),
		[previewCheckpoints, selectedRoute?.id]
	);
	const selectedPreviewDangerZones = useMemo(
		() => previewDangerZones.filter((dangerZone) => dangerZone.routeId === selectedRoute?.id),
		[previewDangerZones, selectedRoute?.id]
	);

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
							Xem lại thông tin và đường đi của tuyến đã tạo.
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
				{submittedRouteName && (
					<div
						data-testid="route-submission-success"
						className="mb-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 font-bold"
					>
						<CheckCircle2 className="size-5 shrink-0" />
						<p>
							Đã gửi tuyến <strong>{submittedRouteName}</strong> để duyệt. Trạng thái chính thức
							hiện là <strong>Chờ duyệt</strong>.
						</p>
					</div>
				)}

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
							onSelect={(route) => {
								setSelectedRouteId(route.id);
								setSubmittedRouteName("");
								setPreviewCheckpoints([]);
								setPreviewDangerZones([]);
							}}
						/>

						{selectedRoute && (
							<RouteGeometryPreview
								geometry={selectedRoute.geometry}
								checkpoints={selectedPreviewCheckpoints}
								dangerZones={selectedPreviewDangerZones}
							/>
						)}
					</div>
				)}

				{selectedRoute && <RouteStatusActionDialog route={selectedRoute} onReload={routes.retry} />}

				{selectedRoute && <RouteWeatherPanel route={selectedRoute} />}

				{selectedRoute && <RouteWeatherRiskPanel route={selectedRoute} />}

				{selectedRoute && <RouteWeatherAdvicePanel route={selectedRoute} />}

				{selectedRoute && (
					<RouteRegistrationBlockPanel routeId={selectedRoute.id} routeName={selectedRoute.name} />
				)}

				{!routes.isLoading && !routes.error && selectedRoute && (
					<RouteDraftWorkspace
						key={`${selectedRoute.id}:${selectedRoute.updatedAt}`}
						route={selectedRoute}
						onRouteChanged={(route) => {
							if (route.status === "pending_approval") setSubmittedRouteName(route.name);
							void routes.retry();
						}}
						onCheckpointsChange={updatePreviewCheckpoints}
						onDangerZonesChange={updatePreviewDangerZones}
					/>
				)}
			</main>
		</div>
	);
}
