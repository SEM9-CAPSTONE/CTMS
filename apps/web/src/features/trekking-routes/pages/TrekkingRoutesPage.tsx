import { AlertCircle, ArrowLeft, Loader2, Map as MapIcon, RefreshCw, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RouteCheckpointsPanel } from "../components/RouteCheckpointsPanel";
import { RouteGeometryPreview } from "../components/RouteGeometryPreview";
import { TrekkingRouteList } from "../components/TrekkingRouteList";
import { useOwnedCampsites } from "../hooks/useOwnedCampsites";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";

export interface TrekkingRoutesPageProps {
	onBackHome?: () => void;
}

export function TrekkingRoutesPage({ onBackHome }: TrekkingRoutesPageProps) {
	const campsites = useOwnedCampsites();
	const requestedCampsiteId = new URLSearchParams(window.location.search).get("campsiteId");
	const [selectedCampsiteId, setSelectedCampsiteId] = useState("");
	const routes = useTrekkingRoutes(selectedCampsiteId || undefined);
	const [selectedRouteId, setSelectedRouteId] = useState<string>();

	useEffect(() => {
		if (campsites.isLoading || campsites.error) return;
		setSelectedCampsiteId((current) => {
			if (current && campsites.items.some((campsite) => campsite.id === current)) return current;
			return requestedCampsiteId &&
				campsites.items.some((campsite) => campsite.id === requestedCampsiteId)
				? requestedCampsiteId
				: "";
		});
	}, [campsites.error, campsites.isLoading, campsites.items, requestedCampsiteId]);

	useEffect(() => {
		setSelectedRouteId((current) =>
			current && routes.items.some((route) => route.id === current) ? current : routes.items[0]?.id
		);
	}, [routes.items]);

	const selectedRoute = useMemo(
		() => routes.items.find((route) => route.id === selectedRouteId),
		[routes.items, selectedRouteId]
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
						<h1 className="text-xl font-extrabold sm:text-2xl">Tuyến trekking của khu cắm trại</h1>
						<p className="text-sm text-[#667a6d]">
							Xem lại thông tin và hình học tuyến đường đã tạo.
						</p>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
				{campsites.isLoading && (
					<div
						data-testid="campsites-loading"
						className="rounded-2xl bg-white p-6 text-sm font-bold"
					>
						Đang tải khu cắm trại...
					</div>
				)}
				{campsites.error && !campsites.isLoading && (
					<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6">
						<div className="flex gap-2 text-red-800">
							<AlertCircle className="size-5" />
							{campsites.error}
						</div>
						<button
							type="button"
							onClick={() => void campsites.retry()}
							className="mt-4 rounded-lg border px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Tải lại
						</button>
					</div>
				)}
				{!campsites.isLoading && !campsites.error && campsites.items.length === 0 && (
					<div
						data-testid="campsites-empty"
						className="rounded-2xl border border-dashed bg-white p-8 text-center"
					>
						<MapIcon className="mx-auto size-10 text-[#8fa096]" />
						<p className="mt-3 font-extrabold">Bạn chưa có khu cắm trại</p>
					</div>
				)}

				{!campsites.isLoading && !campsites.error && campsites.items.length > 0 && (
					<>
						<label
							className="block max-w-xl text-sm font-extrabold text-[#34483b]"
							htmlFor="route-list-campsite"
						>
							Khu cắm trại
						</label>
						<select
							id="route-list-campsite"
							value={selectedCampsiteId}
							onChange={(event) => setSelectedCampsiteId(event.target.value)}
							className="mt-2 w-full max-w-xl rounded-xl border border-[#cbd9ce] bg-white px-4 py-3 font-semibold"
						>
							<option value="">Chọn khu cắm trại</option>
							{campsites.items.map((campsite) => (
								<option key={campsite.id} value={campsite.id}>
									{campsite.name}
								</option>
							))}
						</select>

						{!selectedCampsiteId && (
							<div
								data-testid="route-campsite-prompt"
								className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center text-sm font-bold text-[#667a6d]"
							>
								Chọn khu cắm trại để xem tuyến đường.
							</div>
						)}
						{selectedCampsiteId && routes.isLoading && (
							<div
								data-testid="routes-loading"
								className="mt-6 flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold"
							>
								<Loader2 className="size-4 animate-spin" />
								Đang tải tuyến đường...
							</div>
						)}
						{selectedCampsiteId && routes.error && !routes.isLoading && (
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
						{selectedCampsiteId &&
							!routes.isLoading &&
							!routes.error &&
							routes.items.length === 0 && (
								<div
									data-testid="routes-empty"
									className="mt-6 rounded-2xl border border-dashed bg-white p-8 text-center"
								>
									<Route className="mx-auto size-10 text-[#8fa096]" />
									<p className="mt-3 font-extrabold">Khu cắm trại này chưa có tuyến trekking</p>
								</div>
							)}
						{selectedCampsiteId &&
							!routes.isLoading &&
							!routes.error &&
							routes.items.length > 0 && (
								<>
									<div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
										<TrekkingRouteList
											items={routes.items}
											selectedRouteId={selectedRouteId}
											onSelect={(route) => setSelectedRouteId(route.id)}
										/>
										{selectedRoute && <RouteGeometryPreview geometry={selectedRoute.geometry} />}
									</div>
									{selectedRoute && (
										<RouteCheckpointsPanel key={selectedRoute.id} route={selectedRoute} />
									)}
								</>
							)}
					</>
				)}
			</main>
		</div>
	);
}
