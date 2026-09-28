import { ArrowLeft, Map as MapIcon } from "lucide-react";
import { CreateTrekkingRouteForm } from "../components/CreateTrekkingRouteForm";
import { RouteDraftWorkspace } from "../components/RouteDraftWorkspace";
import { useCreateTrekkingRoute } from "../hooks/useCreateTrekkingRoute";

export interface CreateTrekkingRoutePageProps {
	onBackHome?: () => void;
}

export function CreateTrekkingRoutePage({ onBackHome }: CreateTrekkingRoutePageProps) {
	const creation = useCreateTrekkingRoute();

	if (creation.createdRoute) {
		return (
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
				<h1 className="text-2xl font-extrabold">Hoàn thiện tuyến đường</h1>
				<p className="mt-2 text-sm text-[#667a6d]">
					Đã lưu tuyến nháp. Thêm điểm dừng và khu vực nguy hiểm bên dưới, rồi gửi duyệt khi đã sẵn
					sàng.
				</p>
				<RouteDraftWorkspace key={creation.createdRoute.id} route={creation.createdRoute} />
				<div className="mt-6 flex gap-3">
					<button
						type="button"
						onClick={creation.reset}
						className="rounded-xl border px-4 py-3 font-bold"
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
							Vẽ hoặc nhập một tuyến có thể tái sử dụng cho lịch trình trekking.
						</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
				<CreateTrekkingRouteForm
					isSubmitting={creation.isSubmitting}
					error={creation.error}
					onSubmit={creation.submit}
					onRetry={creation.retry}
				/>
			</main>
		</div>
	);
}
