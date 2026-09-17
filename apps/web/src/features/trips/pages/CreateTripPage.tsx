import { ArrowLeft, CalendarPlus, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { useTrekkingRoutes } from "../../trekking-routes/hooks/useTrekkingRoutes";
import { CreateTripForm } from "../components/CreateTripForm";
import { useCreateTrip } from "../hooks/useCreateTrip";

export interface CreateTripPageProps {
	onBackHome?: () => void;
	onCreateRoute?: () => void;
}

export function CreateTripPage({ onBackHome, onCreateRoute }: CreateTripPageProps) {
	const creation = useCreateTrip();
	const routes = useTrekkingRoutes();
	const activeRoutes = useMemo(
		() => routes.items.filter((route) => route.status === "active"),
		[routes.items]
	);

	if (creation.createdTrip) {
		const trip = creation.createdTrip;
		return (
			<main className="min-h-screen bg-[#f4f7f2] p-5 sm:p-10">
				<section className="mx-auto max-w-2xl rounded-2xl border border-green-200 bg-white p-8 text-center shadow-sm">
					<CheckCircle2 className="mx-auto size-14 text-green-600" />
					<h1 className="mt-4 text-2xl font-extrabold">Tạo trip thành công</h1>
					<p className="mt-2 text-[#667a6d]">
						Trip chỉ được đánh dấu thành công sau khi backend xác nhận tạo draft.
					</p>
					<div className="mt-5 grid gap-3 rounded-xl bg-[#f8faf7] p-5 text-left sm:grid-cols-2">
						<p>
							<b>Trip:</b> {trip.title}
						</p>
						<p>
							<b>Trạng thái:</b> <span data-testid="server-trip-status">{trip.status}</span>
						</p>
						<p>
							<b>Số chỗ đã giữ:</b> <span data-testid="server-seats-taken">{trip.seatsTaken}</span>
						</p>
						<p>
							<b>Số đêm:</b> <span data-testid="server-duration-nights">{trip.durationNights}</span>
						</p>
						<p className="sm:col-span-2">
							<b>ID:</b>{" "}
							<span data-testid="created-trip-id" className="font-mono">
								{trip.id}
							</span>
						</p>
					</div>
					<div className="mt-6 flex justify-center gap-3">
						<button
							type="button"
							onClick={creation.reset}
							className="rounded-xl bg-[#164027] px-4 py-3 font-bold text-white"
						>
							Tạo trip khác
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
						<CalendarPlus className="size-6" />
					</div>
					<div>
						<h1 className="text-xl font-extrabold sm:text-2xl">Tạo trip cho Host</h1>
						<p className="text-sm text-[#667a6d]">
							Tạo draft trip từ tuyến active, giữ đúng BR-055, BR-056 và BR-057.
						</p>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
				<CreateTripForm
					activeRoutes={activeRoutes}
					isRouteLoading={routes.isLoading}
					routeError={routes.error}
					isSubmitting={creation.isSubmitting}
					error={creation.error}
					onSubmit={creation.submit}
					onRetry={creation.retry}
					onRetryRoutes={routes.retry}
					onCreateRoute={onCreateRoute}
				/>
			</main>
		</div>
	);
}
