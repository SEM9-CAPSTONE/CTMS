// Isolated manual fixture entry; not imported by the production router/build.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { DepartureInbox } from "../../src/features/offline-package-policy/components/DepartureInbox";
import { packagePolicyService } from "../../src/features/offline-package-policy/services/package-policy.service";
import type { DepartureNotice } from "../../src/features/offline-package-policy/types";
import { HostTripOperationsPanel } from "../../src/features/trips/components/HostTripOperationsPanel";
import { type TripDetails, formatTripStatus } from "../../src/features/trips/types";

const trip: TripDetails = {
	id: "11111111-1111-4111-8111-111111111111",
	hostId: "preview-host",
	title: "[Mẫu] Sơn Trà — khởi hành bị chặn",
	description: null,
	coverImageUrl: null,
	itinerary: null,
	includes: null,
	excludes: null,
	tripType: "day_trip",
	durationNights: 0,
	startsAt: "2020-01-01T01:00:00Z",
	endsAt: "2099-01-01T08:00:00Z",
	meetingPoint: { type: "Point", coordinates: [108.27, 16.1] },
	meetingAt: null,
	bookingDeadline: "2019-12-31T00:00:00Z",
	capacityMin: 2,
	capacityMax: 10,
	seatsTaken: 4,
	remainingSeats: 6,
	pricePerPerson: 100000,
	cancellationPolicy: null,
	status: "published",
	cancellationReason: null,
	cancelledAt: null,
	difficulty: "moderate",
	weatherRiskLevel: "green",
	isBookable: false,
	createdAt: "2019-12-01T00:00:00Z",
	updatedAt: "2026-11-12T03:00:00Z",
	waypoints: [],
};
let notices: DepartureNotice[] = [
	{
		id: "fixture-1",
		tripId: trip.id,
		reasonCode: "SOURCE_FRESHNESS_UNAVAILABLE",
		createdAt: "2026-11-12T03:00:00Z",
		readAt: null,
		active: true,
	},
	{
		id: "fixture-2",
		tripId: trip.id,
		reasonCode: "PACKAGE_DEPARTURE_NOT_READY",
		createdAt: "2026-11-12T02:00:00Z",
		readAt: null,
		active: false,
	},
];
// No authenticated requests or real mutations are performed by this fixture page.
packagePolicyService.list = async () => notices.map((notice) => ({ ...notice }));
packagePolicyService.read = async (id) => {
	notices = notices.map((notice) =>
		notice.id === id ? { ...notice, readAt: "2026-11-12T03:01:00Z" } : notice
	);
	return { read: true };
};
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function HostPreview() {
	const [detail, setDetail] = useState(new URLSearchParams(location.search).get("detail") === "1");
	const [selected, setSelected] = useState(trip);
	const [message, setMessage] = useState<string | null>(null);
	return (
		<main className="min-h-screen bg-[#f4f7f2] p-4 text-[#10221b] md:p-8">
			<div className="mx-auto max-w-4xl space-y-4">
				<header className="rounded-2xl border bg-white p-5">
					<h1 className="text-xl font-bold">Duyệt giao diện chủ chuyến — CTMS-306</h1>
					<p className="mt-2 font-semibold">
						DỮ LIỆU MẪU — chưa phải bằng chứng kiểm thử kết nối thật.
					</p>
					<p>Tài khoản chủ chuyến mẫu. Thông báo cập nhật khi mở trang hoặc tải lại.</p>
				</header>
				<div
					onClick={(event) => {
						if (!(event.target instanceof HTMLElement)) return;
						const link = event.target.closest("a");
						if (link?.getAttribute("href") === `/trips/${trip.id}`) {
							event.preventDefault();
							setDetail(true);
						}
					}}
				>
					<DepartureInbox actor="preview-host" />
				</div>
				<button
					className="min-h-12 rounded-xl border bg-white px-4 font-semibold"
					type="button"
					onClick={() => setDetail(true)}
				>
					Xem chuyến đã mở bán, quá giờ nhưng chưa thể khởi hành
				</button>
				{detail && (
					<section className="rounded-2xl border bg-white p-5">
						<h2 className="text-lg font-bold">{selected.title}</h2>
						<p>Trạng thái mẫu: {formatTripStatus(selected.status)}. Giờ khởi hành đã qua.</p>
						<p className="my-3 rounded-xl bg-amber-50 p-3 font-semibold">
							Chưa thể khởi hành: chưa biết dữ liệu có còn mới không.
						</p>
						<p>
							Đây là phần điều hành của trang chi tiết chuyến đi. Nút Huỷ chỉ mô phỏng tại trang
							này.
						</p>
						<HostTripOperationsPanel
							trip={selected}
							isSubmitting={false}
							error={null}
							successMessage={message}
							onReschedule={async () => null}
							onRetry={async () => null}
							onReset={() => setMessage(null)}
							onRefreshTrip={() => {}}
							onCancel={async ({ reason }) => {
								const cancelled = {
									...selected,
									status: "cancelled" as const,
									cancellationReason: reason,
								};
								setSelected(cancelled);
								setMessage("Mô phỏng huỷ thành công — không gửi yêu cầu máy chủ.");
								return cancelled;
							}}
						/>
					</section>
				)}
			</div>
		</main>
	);
}
const root = document.getElementById("root");
if (root)
	createRoot(root).render(
		<QueryClientProvider client={queryClient}>
			<HostPreview />
		</QueryClientProvider>
	);
