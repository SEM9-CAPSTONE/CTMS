import {
	Calendar,
	Camera,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileText,
	Info,
	MapPin,
	Navigation,
	ShieldAlert,
	ShieldCheck,
	Users,
	X,
} from "lucide-react";
import {
	type ComponentProps,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { BookingDetails } from "../../booking-details/types";
import { InitializeBookingMembersPanel } from "../../booking-members/components/InitializeBookingMembersPanel";
import type { InitializeBookingMembersResponse } from "../../booking-members/types";
import { PackingListModal } from "../../packing-list/components/PackingListModal";
import { type BookTripResponse, type TripDetails, formatTripStatus } from "../types";
import { type BookingAccess, BookingPanel } from "./BookingPanel";
import { HostTripOperationsPanel } from "./HostTripOperationsPanel";
import type { SelectedEquipmentItem } from "./RentableEquipmentModal";
import { TripCapacityBanner } from "./TripCapacityBanner";
import { formatDateRange, formatVND, getDifficultyBadge, getWeatherRiskBadge } from "./TripCard";
import { TripImageGallery } from "./TripImageGallery";
import { TripRentableEquipment } from "./TripRentableEquipment";

export interface TripDetailViewProps {
	trip: TripDetails;
	onBook?: (
		tripId: string,
		numPeople: number,
		equipment?: SelectedEquipmentItem[]
	) => void | Promise<void>;
	isBooking?: boolean;
	bookingError?: string | null;
	booking?: BookTripResponse | null;
	restoredBookingDetails?: BookingDetails | null;
	bookingAccess?: BookingAccess;
	fieldErrors?: Record<string, string>;
	canRetry?: boolean;
	isConflict?: boolean;
	onBookingRetry?: () => unknown;
	onBookingReset?: () => void;
	onSignIn?: () => void;
	onConflictDismiss?: () => void;
	onConflictReload?: () => void;
	onConflictRetry?: () => void;
	onRefreshBooking?: () => Promise<void> | void;
	onViewBookingDetails?: (bookingId: string) => void;
	canManageTrip?: boolean;
	hostOperations?: ComponentProps<typeof HostTripOperationsPanel>;
	hostPorterManagement?: ReactNode;
}

export function formatDateTime(isoString: string | null | undefined): string {
	if (!isoString) return "Chưa cập nhật";
	const d = new Date(isoString);
	return d.toLocaleDateString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

export function formatWaypointType(type: string): string {
	switch (type) {
		case "start":
			return "Khởi hành";
		case "checkpoint":
			return "Trạm dừng";
		case "rest":
			return "Nghỉ chân";
		case "meal":
			return "Ăn uống";
		case "activity":
			return "Hoạt động";
		case "overnight":
			return "Cắm trại qua đêm";
		case "finish":
			return "Điểm kết thúc";
		default:
			return type;
	}
}

function formatRiskFactorLabel(key: string, label: string): string {
	const labels: Record<string, string> = {
		rainfall: "Lượng mưa",
		wind: "Gió",
		temperature: "Nhiệt độ",
		visibility: "Tầm nhìn",
		thunderstorm: "Dông sét",
	};
	return labels[key] ?? label;
}

function formatRiskFactorValue(key: string, value: number | boolean): string {
	if (typeof value === "boolean") return value ? "Có" : "Không";
	if (key === "temperature") return `${value}°C`;
	if (key === "wind") return `${value} km/h`;
	if (key === "visibility") return `${value} m`;
	if (key === "rainfall") return `${value} mm`;
	return String(value);
}

export function TripDetailView({
	trip,
	onBook,
	isBooking = false,
	bookingError = null,
	booking = null,
	restoredBookingDetails = null,
	bookingAccess = "camper",
	fieldErrors = {},
	canRetry = false,
	isConflict = false,
	onBookingRetry,
	onBookingReset,
	onSignIn,
	onConflictDismiss,
	onConflictReload,
	onConflictRetry,
	onRefreshBooking,
	onViewBookingDetails,
	canManageTrip = false,
	hostOperations,
	hostPorterManagement,
}: TripDetailViewProps) {
	const [packingListRefreshKey, setPackingListRefreshKey] = useState(0);
	const [isPackingListModalOpen, setIsPackingListModalOpen] = useState(false);
	const [bookingTotalAmount, setBookingTotalAmount] = useState<string | null>(null);
	const [selectedPreBookingEquipment, setSelectedPreBookingEquipment] = useState<
		SelectedEquipmentItem[]
	>([]);

	useEffect(() => {
		if (booking && restoredBookingDetails && Array.isArray(restoredBookingDetails.equipmentItems)) {
			const items: SelectedEquipmentItem[] = restoredBookingDetails.equipmentItems.map((eq) => ({
				item: {
					id: eq.equipmentCatalogItemId,
					name: eq.presentation?.currentName ?? "Thiết bị",
					rentalPricePerDay: Number(eq.unitPrice),
					category: "gear",
					hostId: trip.hostId ?? "",
					status: "active" as const,
					quantityTotal: eq.quantity,
					maintenanceSchedule: null,
					createdAt: eq.createdAt,
					updatedAt: eq.createdAt,
				},
				quantity: eq.quantity,
			}));
			setSelectedPreBookingEquipment(items);
		}
	}, [booking, restoredBookingDetails, trip.hostId]);

	const equipmentRentalTotal = useMemo(() => {
		return selectedPreBookingEquipment.reduce(
			(sum, sel) => sum + sel.item.rentalPricePerDay * sel.quantity,
			0
		);
	}, [selectedPreBookingEquipment]);

	const equipmentRentalCount = useMemo(() => {
		return selectedPreBookingEquipment.reduce((sum, sel) => sum + sel.quantity, 0);
	}, [selectedPreBookingEquipment]);

	const [managedImages, setManagedImages] = useState<{ tripId: string; urls: string[] } | null>(
		null
	);
	const tripImages = useMemo<string[]>(() => {
		if (managedImages?.tripId === trip.id)
			return managedImages.urls.length
				? managedImages.urls
				: [
						"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80",
					];
		const result: string[] = [];
		if (trip.coverImageUrl) {
			result.push(trip.coverImageUrl);
		}
		if (result.length === 0) {
			result.push(
				"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
			);
		}
		return result;
	}, [trip.coverImageUrl, trip.id, managedImages]);

	const [activeImageIndex, setActiveImageIndex] = useState(0);
	const [isLightboxOpen, setIsLightboxOpen] = useState(false);
	const handleImagesChange = useCallback(
		(urls: string[]) => {
			setManagedImages({ tripId: trip.id, urls });
			setActiveImageIndex(0);
		},
		[trip.id]
	);

	const handlePrevImage = (e?: React.MouseEvent) => {
		e?.stopPropagation();
		setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : tripImages.length - 1));
	};

	const handleNextImage = (e?: React.MouseEvent) => {
		e?.stopPropagation();
		setActiveImageIndex((prev) => (prev < tripImages.length - 1 ? prev + 1 : 0));
	};

	useEffect(() => {
		if (!isLightboxOpen) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setIsLightboxOpen(false);
			} else if (e.key === "ArrowLeft") {
				setActiveImageIndex((prev) => (prev > 0 ? prev - 1 : tripImages.length - 1));
			} else if (e.key === "ArrowRight") {
				setActiveImageIndex((prev) => (prev < tripImages.length - 1 ? prev + 1 : 0));
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isLightboxOpen, tripImages.length]);

	const handleConfirmEquipment = async (selected: SelectedEquipmentItem[]) => {
		setSelectedPreBookingEquipment(selected);
		if (booking) {
			setPackingListRefreshKey((k) => k + 1);
			await onRefreshBooking?.();
		}
	};

	const handleBookSubmit = async (targetTripId: string, count: number) => {
		if (selectedPreBookingEquipment.length > 0) {
			await onBook?.(targetTripId, count, selectedPreBookingEquipment);
			setSelectedPreBookingEquipment([]);
		} else {
			await onBook?.(targetTripId, count);
		}
	};

	const effectiveBooking = useMemo(() => {
		if (!booking) return null;
		const basePriceNum = Number(booking.basePrice ?? 0);
		const dbTotalNum = Number(bookingTotalAmount ?? booking.totalAmount ?? booking.basePrice ?? 0);
		const computedTotal = (basePriceNum + equipmentRentalTotal).toFixed(2);
		const finalTotal = bookingTotalAmount
			? Number(bookingTotalAmount).toFixed(2)
			: equipmentRentalTotal > 0
				? computedTotal
				: dbTotalNum > 0
					? dbTotalNum.toFixed(2)
					: computedTotal;
		return {
			...booking,
			totalAmount: finalTotal,
		};
	}, [booking, equipmentRentalTotal, bookingTotalAmount]);

	const registrationRisk = trip.registrationRisk ?? {
		status: "unavailable" as const,
		assessmentId: null,
		level: null,
		assessedAt: null,
		ruleVersionId: null,
		factors: [],
		advice: null,
		recommendations: [],
	};
	const difficulty = getDifficultyBadge(trip.difficulty ?? null);
	const weather = getWeatherRiskBadge(registrationRisk.level ?? trip.weatherRiskLevel ?? null);
	const WeatherIcon = weather.icon;
	const isBookingClosed = new Date(trip.bookingDeadline) <= new Date();
	const confirmedRoster = useMemo<InitializeBookingMembersResponse | null>(() => {
		if (
			!booking ||
			!restoredBookingDetails ||
			restoredBookingDetails.id !== booking.id ||
			restoredBookingDetails.members.length !== booking.numPeople
		) {
			return null;
		}
		return {
			bookingId: booking.id,
			members: restoredBookingDetails.members.map(({ email: _email, ...member }) => member),
		};
	}, [booking, restoredBookingDetails]);
	const confirmedLabelsByUserId = useMemo(
		() =>
			new Map(
				(restoredBookingDetails?.members ?? []).flatMap((member) =>
					member.userId && member.email ? [[member.userId, member.email] as const] : []
				)
			),
		[restoredBookingDetails]
	);

	const sortedWaypoints = useMemo(() => {
		if (!trip.waypoints || !Array.isArray(trip.waypoints)) return [];
		return [...trip.waypoints].sort(
			(a, b) => new Date(a.plannedAt ?? 0).getTime() - new Date(b.plannedAt ?? 0).getTime()
		);
	}, [trip.waypoints]);

	const visibleRiskFactors = useMemo(() => {
		const elevated = registrationRisk.factors.filter((factor) => factor.level !== "green");
		return (elevated.length > 0 ? elevated : registrationRisk.factors).slice(0, 3);
	}, [registrationRisk.factors]);

	return (
		<div className="space-y-8">
			{/* Hero Section */}
			<div className="overflow-hidden rounded-3xl border border-[#dfe8df] bg-white shadow-sm">
				<div className="group relative aspect-[21/9] w-full min-h-[260px] bg-slate-900 overflow-hidden">
					{/* Overlay button to open lightbox */}
					<button
						type="button"
						aria-label="Xem ảnh phóng to"
						onClick={() => setIsLightboxOpen(true)}
						className="absolute inset-0 z-0 h-full w-full cursor-pointer bg-transparent text-left"
					/>

					<img
						src={
							tripImages[activeImageIndex] ||
							trip.coverImageUrl ||
							"https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80"
						}
						alt={trip.title}
						className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-102"
					/>
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />

					{/* Navigation controls if multiple images */}
					{tripImages.length > 1 && (
						<>
							<button
								type="button"
								onClick={handlePrevImage}
								aria-label="Hình trước"
								className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 hover:scale-110 active:scale-95"
							>
								<ChevronLeft className="size-6" />
							</button>
							<button
								type="button"
								onClick={handleNextImage}
								aria-label="Hình kế tiếp"
								className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/70 hover:scale-110 active:scale-95"
							>
								<ChevronRight className="size-6" />
							</button>

							<div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
								<Camera className="size-3.5" />
								<span>
									{activeImageIndex + 1} / {tripImages.length}
								</span>
							</div>

							<div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
								{tripImages.map((imgUrl, idx) => (
									<button
										key={`dot-${imgUrl}`}
										type="button"
										aria-label={`Chuyển đến hình ${idx + 1}`}
										onClick={(e) => {
											e.stopPropagation();
											setActiveImageIndex(idx);
										}}
										className={`h-2 rounded-full transition-all ${
											idx === activeImageIndex
												? "w-6 bg-white"
												: "w-2 bg-white/50 hover:bg-white/80"
										}`}
									/>
								))}
							</div>
						</>
					)}

					<div className="pointer-events-none absolute bottom-6 left-6 right-6 flex flex-col gap-2 text-white">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
								{trip.tripType === "day_trip"
									? "Chuyến đi trong ngày"
									: `Chuyến đi qua đêm (${trip.durationNights} đêm)`}
							</span>
							<span
								className={`rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-md ${difficulty.className}`}
							>
								Độ khó: {difficulty.label}
							</span>
							<span
								className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold backdrop-blur-md ${weather.className}`}
							>
								<WeatherIcon className="size-3.5" />
								<span>{weather.label}</span>
							</span>
						</div>

						<h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">{trip.title}</h1>
					</div>
				</div>

				<TripImageGallery
					tripId={trip.id}
					status={trip.status}
					canManage={canManageTrip}
					onImagesChange={handleImagesChange}
				/>
				{/* Key Highlights Bar */}
				<div className="grid gap-4 border-t border-[#dfe8df] p-6 sm:grid-cols-2 lg:grid-cols-4">
					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Calendar className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Thời gian chuyến đi</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{formatDateRange(trip.startsAt, trip.endsAt)}
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<MapPin className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Điểm tập trung</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								[{trip.meetingPoint.coordinates[0].toFixed(3)},{" "}
								{trip.meetingPoint.coordinates[1].toFixed(3)}]
							</p>
							{trip.meetingAt && (
								<p className="text-[11px] text-[#667a6d]">
									Giờ hẹn: {formatDateTime(trip.meetingAt)}
								</p>
							)}
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Users className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Chỗ trống / Sức chứa</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{trip.remainingSeats !== null ? (
									trip.remainingSeats > 0 ? (
										<span className="text-emerald-700">Còn {trip.remainingSeats} chỗ</span>
									) : (
										<span className="text-rose-600">Đã hết chỗ</span>
									)
								) : (
									`${trip.seatsTaken} người đã tham gia`
								)}
							</p>
							<p className="text-[11px] text-[#667a6d]">
								Tối thiểu {trip.capacityMin}
								{trip.capacityMax ? ` - Tối đa ${trip.capacityMax}` : ""} người
							</p>
						</div>
					</div>

					<div className="flex items-start gap-3">
						<div className="rounded-2xl bg-[#164027]/5 p-3 text-[#164027]">
							<Clock className="size-5" />
						</div>
						<div>
							<p className="text-xs font-semibold text-[#667a6d]">Hạn chốt đặt chỗ</p>
							<p className="mt-0.5 text-sm font-bold text-[#10221b]">
								{formatDateTime(trip.bookingDeadline)}
							</p>
							{isBookingClosed && (
								<p className="text-[11px] font-bold text-rose-600">Đã hết hạn đặt vé</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Main Content & Booking Panel Grid */}
			<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
				{/* Left Column: Description, Timeline, Inclusions */}
				<div className="space-y-8">
					{/* Description */}
					{trip.description && (
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h2 className="flex items-center gap-2 text-lg font-extrabold text-[#10221b]">
								<Info className="size-5 text-[#164027]" />
								<span>Giới thiệu hành trình</span>
							</h2>
							<p className="mt-3 text-sm text-[#4f6356] leading-relaxed whitespace-pre-line">
								{trip.description}
							</p>
						</section>
					)}

					{/* Weather Risk Notice */}
					{registrationRisk.status === "unavailable" ? (
						<div
							data-testid="registration-risk-unavailable"
							className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs font-medium text-slate-700"
						>
							<ShieldAlert className="size-5 shrink-0" />
							<div>
								<p className="font-extrabold">Chưa có đánh giá rủi ro thời tiết</p>
								<p className="mt-0.5">
									Hệ thống chưa ghi nhận đánh giá có thẩm quyền cho tuyến đường của chuyến đi này.
									Thông tin này không được xem là mức an toàn mặc định.
								</p>
							</div>
						</div>
					) : (
						<section
							data-testid="registration-risk-panel"
							className={`rounded-2xl border p-4 text-xs ${
								registrationRisk.level === "red"
									? "border-rose-200 bg-rose-50 text-rose-900"
									: registrationRisk.level === "yellow"
										? "border-amber-200 bg-amber-50 text-amber-900"
										: "border-emerald-200 bg-emerald-50 text-emerald-900"
							}`}
						>
							<div className="flex items-start gap-3">
								<ShieldAlert className="size-5 shrink-0" />
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span
											className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${weather.className}`}
										>
											<WeatherIcon className="size-3" />
											{weather.label}
										</span>
									</div>
									<p className="mt-1 leading-relaxed">
										Đánh giá lúc {formatDateTime(registrationRisk.assessedAt)}{" "}
									</p>
									{registrationRisk.advice && (
										<p className="mt-2 leading-relaxed">{registrationRisk.advice}</p>
									)}
								</div>
							</div>

							{visibleRiskFactors.length > 0 && (
								<div className="mt-3 grid gap-2 sm:grid-cols-3">
									{visibleRiskFactors.map((factor) => (
										<div
											key={factor.key}
											className="rounded-xl border border-white/70 bg-white/65 p-2"
										>
											<p className="font-bold">{formatRiskFactorLabel(factor.key, factor.label)}</p>
											<p className="mt-0.5 text-[11px] opacity-80">
												{formatRiskFactorValue(factor.key, factor.value)} · điểm {factor.score} · hệ
												số {factor.weight.toFixed(2)}
											</p>
										</div>
									))}
								</div>
							)}

							{registrationRisk.recommendations.length > 0 && (
								<ul className="mt-3 space-y-1">
									{registrationRisk.recommendations.slice(0, 3).map((item) => (
										<li key={item} className="flex items-start gap-2">
											<Check className="mt-0.5 size-3.5 shrink-0" />
											<span>{item}</span>
										</li>
									))}
								</ul>
							)}
						</section>
					)}

					{/* Waypoints / Itinerary Timeline */}
					<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
						<h2 className="flex items-center gap-2 text-lg font-extrabold text-[#10221b]">
							<Navigation className="size-5 text-[#164027]" />
							<span>Lộ trình & Điểm dừng ({sortedWaypoints.length} điểm)</span>
						</h2>

						{sortedWaypoints.length === 0 ? (
							<p className="mt-4 text-xs text-[#667a6d]">Lộ trình chi tiết đang được cập nhật.</p>
						) : (
							<div className="mt-6 space-y-6">
								{sortedWaypoints.map((wp, index) => (
									<div key={wp.id || index} className="relative flex gap-4">
										{/* Line connecting milestones */}
										{index < sortedWaypoints.length - 1 && (
											<div className="absolute top-8 left-4 -ml-px h-full w-0.5 bg-[#e5eee5]" />
										)}

										{/* Milestone Badge */}
										<div className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-[#164027] bg-white text-xs font-extrabold text-[#164027] shadow-xs">
											{index + 1}
										</div>

										{/* Milestone Details */}
										<div className="flex-1 pb-2">
											<div className="flex flex-wrap items-center gap-2">
												<h4 className="text-sm font-extrabold text-[#10221b]">{wp.name}</h4>
												<span className="rounded-md bg-[#edf3ed] px-2 py-0.5 text-[11px] font-bold text-[#55685a]">
													{formatWaypointType(wp.type)}
												</span>
												{wp.plannedAt && (
													<span className="text-[11px] font-semibold text-[#8fa096]">
														{formatDateTime(wp.plannedAt)}
													</span>
												)}
											</div>

											<div className="mt-1.5 flex flex-wrap gap-4 text-xs text-[#667a6d]">
												{index < sortedWaypoints.length - 1 &&
													wp.plannedAt &&
													sortedWaypoints[index + 1]?.plannedAt && (
														<span className="flex items-center gap-1">
															<Clock className="size-3.5" />
															<span>
																Đến điểm tiếp theo sau{" "}
																{Math.max(
																	0,
																	Math.round(
																		(new Date(
																			sortedWaypoints[index + 1].plannedAt ?? ""
																		).getTime() -
																			new Date(wp.plannedAt).getTime()) /
																			60_000
																	)
																)}{" "}
																phút
															</span>
														</span>
													)}
												<span>
													Tọa độ: [{wp.location.coordinates[0].toFixed(3)},{" "}
													{wp.location.coordinates[1].toFixed(3)}]
												</span>
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</section>

					{/* Rentable Equipment Preview */}
					<TripRentableEquipment
						tripId={trip.id}
						bookingAccess={bookingAccess}
						onSignIn={onSignIn}
						bookingId={booking?.id}
						selectedEquipment={selectedPreBookingEquipment}
						onConfirmSelection={handleConfirmEquipment}
						onTotalAmountChange={setBookingTotalAmount}
					/>

					{/* Cancellation Policy */}
					{trip.cancellationPolicy && (
						<section className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<h3 className="flex items-center gap-2 text-base font-extrabold text-[#10221b]">
								<FileText className="size-5 text-[#164027]" />
								<span>Chính sách hoàn hủy</span>
							</h3>
							<div className="mt-3 text-xs text-[#4f6356] leading-relaxed">
								{typeof trip.cancellationPolicy.policy === "string"
									? trip.cancellationPolicy.policy
									: JSON.stringify(trip.cancellationPolicy)}
							</div>
						</section>
					)}
				</div>

				{/* Right Column: Sticky Booking Action Card & Sidebar */}
				<div className="relative">
					<div className="lg:sticky lg:top-24 space-y-4">
						{canManageTrip && hostOperations && <HostTripOperationsPanel {...hostOperations} />}
						{canManageTrip && hostPorterManagement}

						{/* Overbooking and capacity urgency banner */}
						<TripCapacityBanner
							remainingSeats={trip.remainingSeats}
							bookingDeadline={trip.bookingDeadline}
							isBookable={trip.isBookable}
							status={trip.status}
							cancellationReason={trip.cancellationReason}
						/>

						<div className="rounded-3xl border border-[#dfe8df] bg-white p-5 shadow-sm">
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-xs font-semibold text-[#8fa096]">Giá trọn gói mỗi khách</span>
								<p className="text-2xl font-extrabold text-[#164027]">
									{formatVND(trip.pricePerPerson)}
								</p>
							</div>

							<div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#edf3ed] pt-3 text-center text-xs">
								<div className="rounded-xl bg-[#f8faf8] p-2">
									<span className="block text-[11px] text-[#667a6d]">Trạng thái</span>
									<span className="text-xs font-bold text-[#164027]">
										{trip.status === "published"
											? "Đang mở đăng ký"
											: formatTripStatus(trip.status)}
									</span>
								</div>

								<div className="rounded-xl bg-[#f8faf8] p-2">
									<span className="block text-[11px] text-[#667a6d]">Còn trống</span>
									<span
										data-testid="trip-remaining-seats"
										className="text-xs font-bold text-[#10221b]"
									>
										{trip.remainingSeats !== null
											? trip.remainingSeats > 0
												? `${trip.remainingSeats} chỗ`
												: "Hết chỗ"
											: "Liên hệ"}
									</span>
								</div>

								<div className="rounded-xl bg-[#f8faf8] p-2">
									<span className="block text-[11px] text-[#667a6d]">Hạn đặt</span>
									<span className="text-xs font-bold text-[#10221b]">
										{new Date(trip.bookingDeadline).toLocaleDateString("vi-VN")}
									</span>
								</div>
							</div>

							<div className="mt-3.5 space-y-3">
								<BookingPanel
									trip={trip}
									bookingAccess={bookingAccess}
									booking={effectiveBooking}
									isBooking={isBooking}
									bookingError={bookingError}
									fieldErrors={fieldErrors}
									isConflict={isConflict}
									canRetry={canRetry}
									equipmentRentalTotal={equipmentRentalTotal}
									equipmentRentalCount={equipmentRentalCount}
									onBook={handleBookSubmit}
									onRetry={onBookingRetry ?? onConflictRetry}
									onReset={onBookingReset}
									onSignIn={onSignIn}
									onConflictDismiss={onConflictDismiss}
									onConflictReload={onConflictReload}
									onViewBookingDetails={onViewBookingDetails}
								/>
								{booking && (
									<>
										{!(
											booking.status === "expired" ||
											Boolean(
												booking.holdExpiresAt &&
													new Date(booking.holdExpiresAt).getTime() < Date.now()
											)
										) &&
											booking.numPeople > 1 && (
												<InitializeBookingMembersPanel
													booking={booking}
													confirmedRoster={confirmedRoster}
													confirmedLabelsByUserId={confirmedLabelsByUserId}
												/>
											)}
										<button
											type="button"
											onClick={() => setIsPackingListModalOpen(true)}
											className="flex w-full items-center justify-between rounded-2xl border border-[#dfe8df] bg-white p-3 text-left text-xs font-bold text-[#10221b] shadow-2xs transition hover:border-[#164027]/40 hover:bg-[#f8faf8]"
										>
											<div className="flex items-center gap-2">
												<ShieldCheck className="size-4 text-[#164027]" />
												<span>Xem danh sách đồ cần chuẩn bị</span>
											</div>
											<span className="text-[11px] font-semibold text-[#164027]">
												Chi tiết &rarr;
											</span>
										</button>

										<PackingListModal
											isOpen={isPackingListModalOpen}
											onClose={() => setIsPackingListModalOpen(false)}
											bookingId={booking.id}
											refreshKey={packingListRefreshKey}
										/>
									</>
								)}
							</div>
						</div>

						{/* Host Profile Card */}
						<div className="rounded-3xl border border-[#dfe8df] bg-white p-6 shadow-sm">
							<div className="flex items-center gap-2">
								<Users className="size-5 text-[#164027]" />
								<h3 className="text-base font-extrabold text-[#10221b]">Đơn vị tổ chức</h3>
							</div>
							<div className="mt-4 flex items-center gap-3.5">
								<div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef7f0] font-extrabold text-[#164027] ring-2 ring-[#164027]/20 text-base">
									{trip.host?.fullName ? trip.host.fullName.charAt(0).toUpperCase() : "H"}
								</div>
								<div className="min-w-0 flex-1">
									<h4 className="truncate text-sm font-extrabold text-[#10221b]">
										{trip.host?.fullName || "Host uy tín CTMS"}
									</h4>
									<div className="mt-0.5 flex items-center gap-1.5">
										<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
											Host đã xác thực
										</span>
									</div>
								</div>
							</div>

							{trip.host?.bio && (
								<p className="mt-3.5 text-xs text-[#52665b] leading-relaxed italic border-t border-[#edf3ed] pt-3">
									"{trip.host.bio}"
								</p>
							)}

							<div className="mt-3.5 space-y-1.5 border-t border-[#edf3ed] pt-3 text-xs text-[#667a6d]">
								{trip.host?.email && (
									<div className="flex items-center gap-2">
										<span className="font-semibold text-[#8fa096]">Email:</span>
										<span className="truncate font-medium text-[#10221b]">{trip.host.email}</span>
									</div>
								)}
								{trip.host?.phone && (
									<div className="flex items-center gap-2">
										<span className="font-semibold text-[#8fa096]">Hotline:</span>
										<span className="font-medium text-[#10221b]">{trip.host.phone}</span>
									</div>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Lightbox Modal */}
			{isLightboxOpen && (
				<div
					data-testid="trip-image-lightbox"
					className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 p-4 backdrop-blur-md sm:p-6"
					onClick={() => setIsLightboxOpen(false)}
				>
					<dialog
						open
						aria-label="Xem ảnh chi tiết chuyến đi"
						className="relative m-0 flex h-full w-full max-w-7xl flex-col items-center justify-between border-0 bg-transparent p-0 text-white"
						onClick={(e) => e.stopPropagation()}
					>
						{/* Top header bar */}
						<div className="flex w-full items-center justify-between">
							<div className="flex items-center gap-2">
								<Camera className="size-5 text-emerald-400" />
								<span className="text-sm font-semibold truncate max-w-[240px] sm:max-w-md">
									{trip.title} ({activeImageIndex + 1}/{tripImages.length})
								</span>
							</div>
							<button
								type="button"
								onClick={() => setIsLightboxOpen(false)}
								aria-label="Đóng thư viện hình ảnh"
								className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95"
							>
								<X className="size-6" />
							</button>
						</div>

						{/* Main enlarged image */}
						<div className="relative flex flex-1 w-full items-center justify-center py-2">
							<img
								src={tripImages[activeImageIndex]}
								alt={`${trip.title} - Ảnh ${activeImageIndex + 1}`}
								className="max-h-[70vh] max-w-full rounded-2xl object-contain shadow-2xl"
							/>

							{tripImages.length > 1 && (
								<>
									<button
										type="button"
										onClick={handlePrevImage}
										aria-label="Xem ảnh trước"
										className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 hover:scale-110 active:scale-95"
									>
										<ChevronLeft className="size-7" />
									</button>
									<button
										type="button"
										onClick={handleNextImage}
										aria-label="Xem ảnh kế tiếp"
										className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex size-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/90 hover:scale-110 active:scale-95"
									>
										<ChevronRight className="size-7" />
									</button>
								</>
							)}
						</div>

						{/* Bottom thumbnail strip */}
						{tripImages.length > 1 && (
							<div className="flex max-w-full gap-2 overflow-x-auto px-2 py-2">
								{tripImages.map((imgUrl, idx) => (
									<button
										key={`thumb-${imgUrl}`}
										type="button"
										onClick={() => setActiveImageIndex(idx)}
										aria-label={`Chọn ảnh ${idx + 1}`}
										className={`relative size-16 shrink-0 overflow-hidden rounded-xl border-2 transition ${
											idx === activeImageIndex
												? "border-emerald-500 scale-105 ring-2 ring-emerald-400/50"
												: "border-transparent opacity-60 hover:opacity-100"
										}`}
									>
										<img
											src={imgUrl}
											alt={`Thumbnail ${idx + 1}`}
											className="h-full w-full object-cover"
										/>
									</button>
								))}
							</div>
						)}
					</dialog>
				</div>
			)}
		</div>
	);
}
