import { AlertCircle, ArrowLeft, CheckCircle2, Map as MapIcon, RefreshCw } from "lucide-react";
import { CreateTrekkingRouteForm } from "../components/CreateTrekkingRouteForm";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";
import { useOwnedCampsites } from "../hooks/useOwnedCampsites";

export interface CreateTrekkingRoutePageProps {
	onBackHome?: () => void;
}

export function CreateTrekkingRoutePage({ onBackHome }: CreateTrekkingRoutePageProps) {
	const campsites = useOwnedCampsites();
	const creation = useCreateTrekkingRoute();
	const requestedCampsiteId = new URLSearchParams(window.location.search).get("campsiteId");
	const initialCampsiteId =
		requestedCampsiteId && campsites.items.some((campsite) => campsite.id === requestedCampsiteId)
			? requestedCampsiteId
			: undefined;

	if (creation.createdRoute) {
		const route = creation.createdRoute;
		return (
			<main className="min-h-screen bg-[#f4f7f2] p-5 sm:p-10">
				<section className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
					<CheckCircle2 className="mx-auto size-14 text-green-600" />
					<h1 className="mt-4 text-2xl font-extrabold">Tạo tuyến đường thành công</h1>
					<p className="mt-2 text-[#667a6d]">
						Thông tin dưới đây là kết quả chính thức do máy chủ trả về.
					</p>
					<div className="mt-5 grid gap-3 rounded-xl bg-[#f8faf7] p-5 text-left sm:grid-cols-2">
						<p>
							<b>Tuyến:</b> {route.name}
						</p>
						<p>
							<b>Trạng thái:</b> <span data-testid="server-route-status">{route.status}</span>
						</p>
						<p>
							<b>Chiều dài:</b>{" "}
							<span data-testid="server-route-length">{route.lengthMeters.toFixed(1)} m</span>
						</p>
						<p>
							<b>Độ khó:</b> {route.difficulty}
						</p>
						<p className="sm:col-span-2">
							<b>ID:</b>{" "}
							<span data-testid="created-route-id" className="font-mono">
								{route.id}
							</span>
						</p>
					</div>
					<div className="mt-6 flex justify-center gap-3">
						<button
							type="button"
							onClick={creation.reset}
							className="rounded-xl bg-[#164027] px-4 py-3 font-bold text-white"
						>
							Tạo tuyến khác
						</button>
						{onBackHome && (
							<button
								type="button"
								onClick={onBackHome}
								className="rounded-xl border px-4 py-3 font-bold"
							>
								Về Host Dashboard
							</button>
						)}
					</div>
				</section>
			</main>
		);
	}

	return (
		<div className="min-h-screen bg-[#f4f7f2] text-[#10221b]">
			<header className="border-b bg-white">
				<div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-5 sm:px-6">
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
						<MapIcon className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">Tạo tuyến trekking trên bản đồ</h1>
						<p className="text-sm text-[#667a6d]">
							Vẽ hoặc nhập một tuyến có thể tái sử dụng cho khu cắm trại.
						</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
						<p className="mt-1 text-sm text-[#667a6d]">
							Hãy tạo khu cắm trại trước khi định nghĩa tuyến trekking.
						</p>
					</div>
				)}
				{!campsites.isLoading && !campsites.error && campsites.items.length > 0 && (
					<CreateTrekkingRouteForm
						campsites={campsites.items}
						initialCampsiteId={initialCampsiteId}
						isSubmitting={creation.isSubmitting}
						error={creation.error}
						onSubmit={creation.submit}
						onRetry={creation.retry}
					/>
				)}
			</main>
		</div>
	);
}
