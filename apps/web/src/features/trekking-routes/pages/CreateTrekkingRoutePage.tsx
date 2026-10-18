import { ArrowLeft, Loader2, Map as MapIcon, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { CreateTrekkingRouteForm } from "../components/CreateTrekkingRouteForm";
import { RouteDraftWorkspace } from "../components/RouteDraftWorkspace";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";
import { useTrekkingRoutes } from "../hooks/useTrekkingRoutes";

export interface CreateTrekkingRoutePageProps {
	/** When set, the page edits this saved route instead of creating a new one. */
	routeId?: string;
	onBackHome?: () => void;
	onViewRouteDetail?: (routeId: string) => void;
}

function PageShell({
	title,
	subtitle,
	onBack,
	backLabel,
	children,
}: {
	title: string;
	subtitle: string;
	onBack?: () => void;
	backLabel: string;
	children: ReactNode;
}) {
	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
					{onBack && (
						<button
							type="button"
							aria-label={backLabel}
							onClick={onBack}
							className="rounded-xl border p-2.5"
						>
							<ArrowLeft className="size-5" />
						</button>
					)}
					<div className="rounded-xl bg-emerald-50 p-3 text-[#164027]">
						<MapIcon className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
						<p className="text-sm text-[#667a6d]">{subtitle}</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
		</div>
	);
}

export function CreateTrekkingRoutePage({
	routeId,
	onBackHome,
	onViewRouteDetail,
}: CreateTrekkingRoutePageProps) {
	if (routeId) {
		return (
			<EditTrekkingRoute
				routeId={routeId}
				onBack={onViewRouteDetail ? () => onViewRouteDetail(routeId) : onBackHome}
			/>
		);
	}
	return <CreateTrekkingRoute onBackHome={onBackHome} onViewRouteDetail={onViewRouteDetail} />;
}

function CreateTrekkingRoute({
	onBackHome,
	onViewRouteDetail,
}: Pick<CreateTrekkingRoutePageProps, "onBackHome" | "onViewRouteDetail">) {
	const creation = useCreateTrekkingRoute();
	const createdRoute = creation.createdRoute;

	if (createdRoute) {
		return (
			<PageShell
				title="Hoàn thiện tuyến đường"
				subtitle="Đã lưu tuyến nháp. Thêm vị trí và khu vực nguy hiểm bên dưới, rồi gửi duyệt khi đã sẵn sàng."
				onBack={onBackHome}
				backLabel="Quay về Host Dashboard"
			>
				<RouteDraftWorkspace key={createdRoute.id} route={createdRoute} />
				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={creation.reset}
						className="rounded-xl border px-4 py-3 font-bold"
					>
						Tạo tuyến khác
					</button>
					{onViewRouteDetail && (
						<button
							type="button"
							onClick={() => onViewRouteDetail(createdRoute.id)}
							className="rounded-xl border px-4 py-3 font-bold"
						>
							Xem chi tiết tuyến
						</button>
					)}
				</div>
			</PageShell>
		);
	}

	return (
		<PageShell
			title="Tạo tuyến trekking trên bản đồ"
			subtitle="Vẽ một tuyến có thể tái sử dụng cho lịch trình trekking."
			onBack={onBackHome}
			backLabel="Quay về Host Dashboard"
		>
			<CreateTrekkingRouteForm
				isSubmitting={creation.isSubmitting}
				error={creation.error}
				onSubmit={creation.submit}
				onRetry={creation.retry}
			/>
		</PageShell>
	);
}

function EditTrekkingRoute({ routeId, onBack }: { routeId: string; onBack?: () => void }) {
	const routes = useTrekkingRoutes();
	const route = routes.items.find((item) => item.id === routeId);

	return (
		<PageShell
			title="Chỉnh sửa tuyến trekking"
			subtitle="Cập nhật thông tin, đường đi, các vị trí trên tuyến, rồi gửi duyệt khi đã sẵn sàng."
			onBack={onBack}
			backLabel="Quay về chi tiết tuyến"
		>
			{routes.isLoading && (
				<div className="flex items-center gap-2 rounded-2xl bg-white p-6 text-sm font-bold">
					<Loader2 className="size-4 animate-spin" />
					Đang tải tuyến đường...
				</div>
			)}
			{routes.error && !routes.isLoading && (
				<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
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
			{route && <RouteDraftWorkspace key={route.id} route={route} mode="edit" />}
		</PageShell>
	);
}
