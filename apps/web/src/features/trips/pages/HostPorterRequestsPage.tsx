import {
	AlertTriangle,
	BriefcaseBusiness,
	Clock,
	Loader2,
	type LucideIcon,
	RefreshCw,
	Send,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { AvailablePortersPanel } from "../components/AvailablePortersPanel";
import { formatDateRange } from "../components/TripCard";
import { useMyTrips } from "../hooks/useMyTrips";
import { type TripDetails, formatTripStatus } from "../types";

type PorterTab = "find" | "requests" | "assigned";

interface HostPorterRequestsPageProps {
	initialTripId?: string | null;
}

const tabs: Array<{ key: PorterTab; label: string; icon: LucideIcon }> = [
	{ key: "find", label: "Tìm Porter", icon: Send },
	{ key: "requests", label: "Yêu cầu đã gửi", icon: Clock },
	{ key: "assigned", label: "Đã phân công", icon: Users },
];

function syncSelectedTripToUrl(tripId: string) {
	const nextUrl = `/host/porter?tripId=${encodeURIComponent(tripId)}`;
	window.history.replaceState({}, "", nextUrl);
}

function getTripOptionLabel(trip: TripDetails): string {
	return `${trip.title} - ${formatTripStatus(trip.status)} - ${formatDateRange(trip.startsAt, trip.endsAt)}`;
}

function EmptyFutureTab({ title }: { title: string }) {
	return (
		<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-8 text-center shadow-sm">
			<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
				<BriefcaseBusiness className="size-6" />
			</div>
			<h2 className="mt-4 text-lg font-extrabold text-[#10221b]">{title}</h2>
			<p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#667a6d]">
				Phần này thuộc luồng theo dõi request và phân công sau khi Porter phản hồi. Phiên này chỉ
				triển khai thao tác tìm Porter và gửi yêu cầu.
			</p>
		</section>
	);
}

export function HostPorterRequestsPage({ initialTripId }: HostPorterRequestsPageProps) {
	const { trips, isLoading, error, refetch } = useMyTrips();
	const [activeTab, setActiveTab] = useState<PorterTab>("find");
	const [selectedTripId, setSelectedTripId] = useState(initialTripId ?? "");

	useEffect(() => {
		if (initialTripId) {
			setSelectedTripId(initialTripId);
		}
	}, [initialTripId]);

	useEffect(() => {
		if (selectedTripId || trips.length === 0) return;
		setSelectedTripId(trips[0].id);
		syncSelectedTripToUrl(trips[0].id);
	}, [selectedTripId, trips]);

	const selectedTrip = useMemo(
		() => trips.find((trip) => trip.id === selectedTripId) ?? null,
		[trips, selectedTripId]
	);
	const selectedTripMissing = Boolean(selectedTripId && trips.length > 0 && !selectedTrip);

	return (
		<div className="min-h-screen bg-[#f4f7f2] px-4 py-8 sm:px-6">
			<div className="mx-auto max-w-7xl space-y-6">
				<header className="flex flex-col gap-4 rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-xs font-extrabold uppercase tracking-wide text-[#667a6d]">
							Host Porter
						</p>
						<h1 className="mt-1 text-2xl font-extrabold text-[#10221b]">
							Quản lý Porter theo Trip
						</h1>
						<p className="mt-2 max-w-3xl text-sm leading-6 text-[#667a6d]">
							Trip được duyệt độc lập với Porter. Tại đây Host chọn Trip, tìm Porter đủ điều kiện và
							gửi lời mời tham gia Trip.
						</p>
					</div>
					<div className="rounded-2xl bg-[#164027]/5 px-4 py-3 text-xs font-bold text-[#164027]">
						Request không giữ lịch cho đến khi Porter chấp nhận hợp lệ.
					</div>
				</header>

				<div className="flex flex-wrap gap-2 border-b border-[#dfe8df]">
					{tabs.map((tab) => {
						const Icon = tab.icon;
						const isActive = activeTab === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								onClick={() => setActiveTab(tab.key)}
								className={`inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-extrabold transition ${
									isActive
										? "border-[#164027] text-[#164027]"
										: "border-transparent text-[#667a6d] hover:border-slate-300 hover:text-[#10221b]"
								}`}
							>
								<Icon className="size-4" />
								<span>{tab.label}</span>
							</button>
						);
					})}
				</div>

				{activeTab === "find" && (
					<div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm">
							<div className="flex items-start gap-3">
								<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
									<BriefcaseBusiness className="size-5" />
								</div>
								<div>
									<h2 className="text-base font-extrabold text-[#10221b]">Chọn Trip</h2>
									<p className="mt-1 text-xs leading-5 text-[#667a6d]">
										Danh sách này lấy từ các Trip Host đang quản lý.
									</p>
								</div>
							</div>

							{isLoading && (
								<output className="mt-5 flex items-center gap-2 rounded-2xl bg-[#f8faf8] p-4 text-xs font-bold text-[#164027]">
									<Loader2 className="size-4 animate-spin" />
									Đang tải Trip...
								</output>
							)}

							{!isLoading && error && (
								<div
									role="alert"
									className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
								>
									<div className="flex items-start gap-2">
										<AlertTriangle className="size-4 shrink-0" />
										<p className="font-bold">{error}</p>
									</div>
									<Button size="sm" variant="outline" className="mt-3 gap-2" onClick={refetch}>
										<RefreshCw className="size-3.5" />
										Tải lại
									</Button>
								</div>
							)}

							{!isLoading && !error && trips.length === 0 && (
								<div className="mt-5 rounded-2xl border border-dashed border-[#cbd9cd] bg-[#f8faf8] p-5 text-center text-xs text-[#667a6d]">
									Chưa có Trip nào để gửi Porter Request.
								</div>
							)}

							{!isLoading && !error && trips.length > 0 && (
								<>
									<label
										htmlFor="host-porter-trip"
										className="mt-5 block text-xs font-extrabold text-[#10221b]"
									>
										Trip
									</label>
									<select
										id="host-porter-trip"
										value={selectedTripId}
										onChange={(event) => {
											setSelectedTripId(event.target.value);
											syncSelectedTripToUrl(event.target.value);
										}}
										className="mt-2 w-full rounded-2xl border border-[#cbd9cd] bg-white px-3 py-3 text-sm font-semibold text-[#10221b] outline-none transition focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/15"
									>
										{trips.map((trip) => (
											<option key={trip.id} value={trip.id}>
												{getTripOptionLabel(trip)}
											</option>
										))}
									</select>

									{selectedTrip && (
										<div className="mt-4 rounded-2xl bg-[#f8faf8] p-4 text-xs text-[#55685a]">
											<p className="font-extrabold text-[#10221b]">{selectedTrip.title}</p>
											<p className="mt-1">
												{formatDateRange(selectedTrip.startsAt, selectedTrip.endsAt)}
											</p>
											<p className="mt-1">Trạng thái: {formatTripStatus(selectedTrip.status)}</p>
										</div>
									)}

									{selectedTripMissing && (
										<div
											role="alert"
											className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900"
										>
											Không tìm thấy Trip đã chọn trong danh sách Host đang quản lý.
										</div>
									)}
								</>
							)}
						</section>

						{selectedTrip ? (
							<AvailablePortersPanel tripId={selectedTrip.id} />
						) : (
							<section className="rounded-3xl border border-dashed border-[#cbd9cd] bg-white p-8 text-center shadow-sm">
								<BriefcaseBusiness className="mx-auto size-8 text-[#164027]" />
								<p className="mt-3 text-sm font-extrabold text-[#10221b]">
									Chọn Trip để tìm Porter phù hợp.
								</p>
							</section>
						)}
					</div>
				)}

				{activeTab === "requests" && <EmptyFutureTab title="Yêu cầu đã gửi" />}
				{activeTab === "assigned" && <EmptyFutureTab title="Đã phân công" />}
			</div>
		</div>
	);
}
