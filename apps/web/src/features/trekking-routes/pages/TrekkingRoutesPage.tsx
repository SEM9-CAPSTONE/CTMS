import { ArrowLeft, Loader2, Plus, RefreshCw, Route } from "lucide-react";
import { useEffect, useState } from "react";
import { HostRouteDetail } from "../components/HostRouteDetail";
import { HostRouteFilters } from "../components/HostRouteFilters";
import { RouteListPagination } from "../components/RouteListPagination";
import { TrekkingRouteList } from "../components/TrekkingRouteList";
import { useHostRouteBrowser } from "../hooks/useHostRouteBrowser";
export interface TrekkingRoutesPageProps {
	onBackHome?: () => void;
	onViewRouteDetail?: (id: string) => void;
	onCreateRoute?: () => void;
	onEditRoute?: (id: string) => void;
}
export function TrekkingRoutesPage({
	onBackHome,
	onViewRouteDetail,
	onCreateRoute,
	onEditRoute,
}: TrekkingRoutesPageProps) {
	const routes = useHostRouteBrowser();
	const [selectedId, setSelectedId] = useState<string>();
	useEffect(() => {
		setSelectedId((current) =>
			routes.items.some((route) => route.id === current) ? current : routes.items[0]?.id
		);
	}, [routes.items]);
	const selected = routes.items.find((route) => route.id === selectedId) ?? routes.items[0];
	return (
		<div className="min-h-screen bg-[#f7f9f7] text-[#10221b]">
			<div data-testid="route-browser-heading" className="sticky top-[67px] z-20 bg-white lg:top-0">
				<header className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-4 lg:px-5">
					<div className="flex min-w-0 items-center gap-3">
						{onBackHome && (
							<button
								type="button"
								aria-label="Quay về Host Dashboard"
								onClick={onBackHome}
								className="rounded-xl border border-[#d8e2da] p-2.5"
							>
								<ArrowLeft className="size-5" />
							</button>
						)}
						<span className="rounded-2xl bg-[#eff8f3] p-3 text-[#164d32]">
							<Route className="size-6" />
						</span>
						<h1 className="text-lg font-extrabold sm:text-2xl">Tuyến trekking của Host</h1>
					</div>
					{onCreateRoute && (
						<button
							type="button"
							onClick={onCreateRoute}
							className="flex items-center gap-2 rounded-xl bg-[#164d32] px-4 py-3 text-sm font-bold text-white hover:bg-[#103b26]"
						>
							<Plus className="size-5" />
							Tạo tuyến mới
						</button>
					)}
				</header>
				<HostRouteFilters
					status={routes.statusFilter}
					counts={routes.statusCounts}
					search={routes.search}
					sort={routes.sort}
					onStatusChange={routes.setStatusFilter}
					onSearchChange={routes.setSearch}
					onSortChange={routes.setSort}
				/>
			</div>
			<main className="relative z-0 grid items-stretch xl:grid-cols-[minmax(18rem,0.38fr)_minmax(0,0.62fr)]">
				<aside
					aria-label="Danh sách tuyến của Host"
					className="flex min-h-0 flex-col border-b border-[#e0e7e2] xl:border-r xl:border-b-0"
				>
					<div className="min-h-0 flex-1 overflow-y-auto p-3 xl:h-0 xl:min-h-96">
						{routes.isLoading && (
							<div
								data-testid="routes-loading"
								className="flex items-center justify-center gap-2 p-8 text-sm text-[#667a6d]"
							>
								<Loader2 className="size-4 animate-spin" />
								Đang tải tuyến đường...
							</div>
						)}
						{routes.error && !routes.isLoading && (
							<div
								role="alert"
								className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
							>
								{routes.error}
								<button
									type="button"
									onClick={() => void routes.retry()}
									className="mt-3 flex items-center gap-2 font-bold"
								>
									<RefreshCw className="size-4" />
									Tải lại
								</button>
							</div>
						)}
						{!routes.isLoading && !routes.error && !routes.items.length && (
							<div
								data-testid="routes-empty"
								className="rounded-xl border border-dashed border-[#d8e2da] bg-white px-5 py-12 text-center"
							>
								<Route className="mx-auto size-8 text-[#93a397]" />
								<p className="mt-3 text-sm font-bold">
									{routes.statusFilter === "all" && !routes.search.trim()
										? "Bạn chưa có tuyến trekking"
										: "Không có tuyến trekking phù hợp với bộ lọc"}
								</p>
							</div>
						)}
						{!routes.isLoading && !routes.error && routes.items.length > 0 && (
							<TrekkingRouteList
								items={routes.items}
								selectedRouteId={selected?.id}
								onSelect={(route) => setSelectedId(route.id)}
							/>
						)}
					</div>
					{!routes.isLoading && !routes.error && (
						<RouteListPagination pagination={routes.pagination} onPageChange={routes.setPage} />
					)}
				</aside>
				<div className="min-w-0 p-3 lg:p-4">
					{selected && !routes.isLoading && !routes.error ? (
						<HostRouteDetail route={selected} onEdit={onEditRoute} onDetail={onViewRouteDetail} />
					) : (
						<div className="grid min-h-96 place-items-center rounded-2xl border border-[#e0e7e2] bg-white p-6 text-center text-sm text-[#7a8b7f]">
							<div>
								<Route className="mx-auto mb-3 size-10 text-[#a8b7ac]" />
								Chọn tuyến để xem bản đồ và cảnh báo
							</div>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}
