import { zodResolver } from "@hookform/resolvers/zod";
import {
	AlertCircle,
	ArrowRight,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock3,
	ImagePlus,
	Loader2,
	RefreshCw,
	Route,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { CreatedTrekkingRoute, Position } from "../../trekking-routes/types";
import type { CreateTripError } from "../hooks/useCreateTrip";
import {
	CREATE_TRIP_DEFAULT_VALUES,
	type CreateTripFormValues,
	createCreateTripFormSchema,
	inferTripTypeFromSchedule,
	toCreateTripInput,
} from "../schema/create-trip.schema";
import type { CreateTripInput } from "../types";
import { TripRouteMap } from "./TripRouteMap";

interface Props {
	activeRoutes: CreatedTrekkingRoute[];
	isRouteLoading: boolean;
	routeError: string;
	isSubmitting: boolean;
	error: CreateTripError | null;
	onSubmit: (payload: CreateTripInput) => Promise<unknown>;
	onRetry: () => Promise<unknown>;
	onRetryRoutes: () => void;
	onCreateRoute?: () => void;
	defaultValues?: CreateTripFormValues;
	draftStorageKey?: string;
	submitLabel?: string;
	submittingLabel?: string;
	title?: string;
	allowPastScheduleValues?: boolean;
}

const inputClass =
	"mt-1 w-full rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]";
const MAX_COVER_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_REASONABLE_TREKKING_METERS_PER_MINUTE = 100;
const DEFAULT_DATE_TIME = "08:00";

type RangeSide = "start" | "end";

const backendFieldMap: Record<string, keyof CreateTripFormValues> = {
	endsAt: "endsAt",
	bookingDeadline: "bookingDeadline",
	meetingAt: "meetingAt",
	capacityMin: "capacityMin",
	waypoints: "waypoints",
};

function toDateTimeLocalInputValue(date: Date): string {
	const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
	return localDate.toISOString().slice(0, 16);
}

function toLocalDateKey(date: Date): string {
	return toDateTimeLocalInputValue(date).slice(0, 10);
}

function getDateTimeDate(value: string): Date | null {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function getDatePart(value: string): string {
	return value.slice(0, 10);
}

function getTimePart(value: string, fallback = DEFAULT_DATE_TIME): string {
	const time = value.slice(11, 16);
	return time || fallback;
}

function composeDateTime(dateKey: string, time: string): string {
	return `${dateKey}T${time || DEFAULT_DATE_TIME}`;
}

function compareDateTimeLocalValues(first: string, second: string): number {
	const firstTime = getDateTimeDate(first)?.getTime();
	const secondTime = getDateTimeDate(second)?.getTime();
	if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return 0;
	return (firstTime ?? 0) - (secondTime ?? 0);
}

function maxDateTimeLocalValue(...values: string[]): string {
	return values
		.filter(Boolean)
		.reduce(
			(maximum, value) =>
				!maximum || compareDateTimeLocalValues(value, maximum) > 0 ? value : maximum,
			""
		);
}

function getPastDateTimeMessage(
	value: string,
	minimum: string,
	message: string
): string | undefined {
	if (!value || !minimum) return undefined;
	return compareDateTimeLocalValues(value, minimum) < 0 ? message : undefined;
}

function formatCalendarMonth(date: Date): string {
	return `${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatSoftDate(value: string): { day: string; monthYear: string } {
	const date = getDateTimeDate(value);
	if (!date) return { day: "--", monthYear: "Chưa chọn ngày" };
	return {
		day: date.toLocaleDateString("vi-VN", { day: "2-digit" }),
		monthYear: date.toLocaleDateString("vi-VN", {
			month: "short",
			year: "numeric",
		}),
	};
}

function formatDateTimeField(value: string, placeholder = "Chọn thời gian"): string {
	const date = getDateTimeDate(value);
	if (!date) return placeholder;
	return date.toLocaleString("vi-VN", {
		hour: "2-digit",
		minute: "2-digit",
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	});
}

function formatDateTimeRangeField(startsAt: string, endsAt: string): string {
	if (!startsAt && !endsAt) return "Chọn thời gian bắt đầu và kết thúc";
	if (!startsAt) return `Kết thúc ${formatDateTimeField(endsAt)}`;
	if (!endsAt) return `Bắt đầu ${formatDateTimeField(startsAt)}`;
	return `${formatDateTimeField(startsAt)} - ${formatDateTimeField(endsAt)}`;
}

function isInvalidDateTimeOrderMessage(message: string | undefined): boolean {
	return message === "Thời gian bắt đầu không được sau thời gian kết thúc";
}

function getCalendarCells(monthDate: Date): Date[] {
	const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
	const start = new Date(firstDay);
	start.setDate(firstDay.getDate() - firstDay.getDay());
	return Array.from({ length: 42 }, (_, index) => {
		const day = new Date(start);
		day.setDate(start.getDate() + index);
		return day;
	});
}

function makeInitialMonth(...values: string[]): Date {
	const firstDate = values.map(getDateTimeDate).find((date): date is Date => Boolean(date));
	return firstDate ?? new Date();
}

function isDateBeforeDay(date: Date, minimum: string): boolean {
	const minimumDate = getDateTimeDate(minimum);
	if (!minimumDate) return false;
	const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const minimumDay = new Date(
		minimumDate.getFullYear(),
		minimumDate.getMonth(),
		minimumDate.getDate()
	).getTime();
	return dateDay < minimumDay;
}

function isDateAfterDay(date: Date, maximum: string): boolean {
	const maximumDate = getDateTimeDate(maximum);
	if (!maximumDate) return false;
	const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
	const maximumDay = new Date(
		maximumDate.getFullYear(),
		maximumDate.getMonth(),
		maximumDate.getDate()
	).getTime();
	return dateDay > maximumDay;
}

interface DateTimeSummaryCardProps {
	label: string;
	value: string;
	active?: boolean;
	compact?: boolean;
	disabled?: boolean;
	error?: string;
	defaultTime?: string;
	onFocus?: () => void;
	onTimeChange: (time: string) => void;
	onClear?: () => void;
}

function DateTimeSummaryCard({
	label,
	value,
	active = false,
	compact = false,
	disabled = false,
	error,
	defaultTime = DEFAULT_DATE_TIME,
	onFocus,
	onTimeChange,
	onClear,
}: DateTimeSummaryCardProps) {
	const formatted = formatSoftDate(value);
	const cardTestId =
		label === "Bắt đầu"
			? "date-time-card-start"
			: label === "Kết thúc"
				? "date-time-card-end"
				: undefined;

	return (
		<div
			data-testid={cardTestId}
			className={`rounded-2xl border bg-white shadow-sm transition ${compact ? "p-3" : "p-4"} ${
				active
					? "border-[#16a34a] ring-4 ring-[#16a34a]/10"
					: "border-[#dce8dd] hover:border-[#9db6a3]"
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<button
					type="button"
					disabled={disabled}
					onClick={onFocus}
					className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
				>
					<span className="block text-xs font-bold text-[#7a8b81]">{label}</span>
					<span className={`flex items-baseline gap-2 ${compact ? "mt-1" : "mt-2"}`}>
						<span
							className={`font-light leading-none text-[#16a34a] ${compact ? "text-3xl" : "text-4xl"}`}
						>
							{formatted.day}
						</span>
						<span className="truncate text-sm font-semibold text-[#34483b]">
							{formatted.monthYear}
						</span>
					</span>
				</button>
				{onClear && value && (
					<button
						type="button"
						aria-label={`Xóa ${label.toLowerCase()}`}
						disabled={disabled}
						onClick={onClear}
						className="rounded-full p-1 text-[#9aa89f] transition hover:bg-[#f2f6f2] hover:text-[#34483b] disabled:opacity-50"
					>
						<X className="size-4" />
					</button>
				)}
			</div>
			<label
				className={`flex items-center gap-2 rounded-xl border border-[#dce8dd] bg-[#fbfdfb] px-3 text-sm font-semibold text-[#34483b] focus-within:border-[#16a34a] focus-within:ring-2 focus-within:ring-[#16a34a]/10 ${
					compact ? "mt-2 py-1.5" : "mt-3 py-2"
				}`}
			>
				<Clock3 className="size-4 text-[#7a8b81]" />
				<input
					type="time"
					aria-label={`${label} - giờ`}
					disabled={disabled}
					value={getTimePart(value, defaultTime)}
					onFocus={onFocus}
					onChange={(event) => onTimeChange(event.target.value)}
					className="w-full bg-transparent font-mono tracking-[0.16em] outline-none"
				/>
			</label>
			{error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
		</div>
	);
}

interface SoftCalendarProps {
	monthDate: Date;
	selectedStart?: string;
	selectedEnd?: string;
	minValue?: string;
	maxValue?: string;
	compact?: boolean;
	disabled?: boolean;
	onPreviousMonth: () => void;
	onNextMonth: () => void;
	onSelectDate: (dateKey: string) => void;
}

function SoftCalendar({
	monthDate,
	selectedStart = "",
	selectedEnd = "",
	minValue = "",
	maxValue = "",
	compact = false,
	disabled = false,
	onPreviousMonth,
	onNextMonth,
	onSelectDate,
}: SoftCalendarProps) {
	const cells = getCalendarCells(monthDate);
	const startDate = getDateTimeDate(selectedStart);
	const endDate = getDateTimeDate(selectedEnd);
	const startKey = selectedStart ? getDatePart(selectedStart) : "";
	const endKey = selectedEnd ? getDatePart(selectedEnd) : "";

	return (
		<div className={`rounded-2xl bg-[#fbfdfb] ${compact ? "max-w-[340px] p-3" : "p-4"}`}>
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					aria-label="Tháng trước"
					disabled={disabled}
					onClick={onPreviousMonth}
					className={`flex items-center justify-center rounded-xl bg-white text-[#607368] shadow-sm ring-1 ring-[#e4eee5] transition hover:text-[#164027] disabled:opacity-50 ${
						compact ? "size-8" : "size-10"
					}`}
				>
					<ChevronLeft className="size-4" />
				</button>
				<p className={`${compact ? "text-xs" : "text-sm"} font-extrabold text-[#10221b]`}>
					{formatCalendarMonth(monthDate)}
				</p>
				<button
					type="button"
					aria-label="Tháng sau"
					disabled={disabled}
					onClick={onNextMonth}
					className={`flex items-center justify-center rounded-xl bg-white text-[#607368] shadow-sm ring-1 ring-[#e4eee5] transition hover:text-[#164027] disabled:opacity-50 ${
						compact ? "size-8" : "size-10"
					}`}
				>
					<ChevronRight className="size-4" />
				</button>
			</div>
			<div
				className={`grid grid-cols-7 text-center text-[11px] font-bold uppercase text-[#a0ada5] ${
					compact ? "mt-3" : "mt-4"
				}`}
			>
				{["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((day) => (
					<span key={day}>{day}</span>
				))}
			</div>
			<div className={`mt-2 grid grid-cols-7 ${compact ? "gap-1" : "gap-1.5"}`}>
				{cells.map((date) => {
					const key = toLocalDateKey(date);
					const isCurrentMonth = date.getMonth() === monthDate.getMonth();
					const isSelected = key === startKey || key === endKey;
					const isInRange =
						startDate &&
						endDate &&
						date > new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()) &&
						date < new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
					const isOutOfRange = isDateBeforeDay(date, minValue) || isDateAfterDay(date, maxValue);

					return (
						<button
							key={key}
							type="button"
							disabled={disabled}
							onClick={() => onSelectDate(key)}
							className={`flex aspect-square items-center justify-center font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${
								compact ? "rounded-lg text-xs" : "rounded-xl text-sm"
							} ${
								isSelected
									? "bg-[#2563eb] text-white shadow-sm shadow-[#2563eb]/20"
									: isInRange
										? "bg-[#eaf1ff] text-[#1d4ed8]"
										: isOutOfRange
											? "text-rose-700 hover:bg-rose-50"
											: isCurrentMonth
												? "text-[#46584d] hover:bg-white hover:text-[#164027] hover:shadow-sm"
												: "text-[#c2ccc5] hover:bg-white/70"
							}`}
						>
							{date.getDate()}
						</button>
					);
				})}
			</div>
		</div>
	);
}

interface SoftDateTimeRangePickerProps {
	title: string;
	startsAt: string;
	endsAt: string;
	minValue?: string;
	disabled?: boolean;
	startError?: string;
	endError?: string;
	onStartChange: (value: string) => void;
	onEndChange: (value: string) => void;
}

function SoftDateTimeRangePicker({
	title,
	startsAt,
	endsAt,
	minValue = "",
	disabled = false,
	startError,
	endError,
	onStartChange,
	onEndChange,
}: SoftDateTimeRangePickerProps) {
	const [activeSide, setActiveSide] = useState<RangeSide>("start");
	const [isOpen, setIsOpen] = useState(false);
	const [monthDate, setMonthDate] = useState(() => makeInitialMonth(startsAt, endsAt));
	const popoverRef = useRef<HTMLDivElement | null>(null);
	const activeStartError =
		activeSide === "start" && isInvalidDateTimeOrderMessage(endError) ? endError : startError;
	const activeEndError =
		activeSide === "start" && isInvalidDateTimeOrderMessage(endError) ? undefined : endError;

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: PointerEvent) => {
			if (!popoverRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen]);

	const updateMonth = (direction: number) => {
		setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
	};

	const handleSelectDate = (dateKey: string) => {
		if (activeSide === "start") {
			onStartChange(composeDateTime(dateKey, getTimePart(startsAt, DEFAULT_DATE_TIME)));
			return;
		}
		onEndChange(composeDateTime(dateKey, getTimePart(endsAt, "17:00")));
	};

	return (
		<div ref={popoverRef} className="relative">
			<div className="block text-sm font-bold text-[#34483b]">
				<span>{title}</span>
				<button
					type="button"
					disabled={disabled}
					aria-expanded={isOpen}
					aria-label={`Mở ${title.toLowerCase()}`}
					onClick={() => setIsOpen((current) => !current)}
					className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#10221b] outline-none transition hover:border-[#9db6a3] focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]"
				>
					<span className={startsAt || endsAt ? "" : "text-[#7b8c82]"}>
						{formatDateTimeRangeField(startsAt, endsAt)}
					</span>
					<CalendarDays className="size-4 shrink-0 text-[#607368]" />
				</button>
			</div>
			{(startError || endError) && !isOpen && (
				<div className="mt-1 space-y-0.5 text-xs font-semibold text-red-600">
					{startError && <p>{startError}</p>}
					{endError && <p>{endError}</p>}
				</div>
			)}
			{isOpen && (
				<div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-[#dce8dd] bg-[#f8fbf7] p-3 shadow-2xl">
					<div className="grid gap-3 lg:grid-cols-[minmax(260px,340px)_minmax(220px,260px)]">
						<SoftCalendar
							monthDate={monthDate}
							selectedStart={startsAt}
							selectedEnd={endsAt}
							minValue={minValue}
							compact
							disabled={disabled}
							onPreviousMonth={() => updateMonth(-1)}
							onNextMonth={() => updateMonth(1)}
							onSelectDate={handleSelectDate}
						/>
						<div className="flex flex-col gap-2 self-start">
							<DateTimeSummaryCard
								label="Bắt đầu"
								value={startsAt}
								active={activeSide === "start"}
								compact
								disabled={disabled}
								error={activeStartError}
								onFocus={() => setActiveSide("start")}
								onTimeChange={(time) =>
									onStartChange(
										composeDateTime(getDatePart(startsAt) || toLocalDateKey(monthDate), time)
									)
								}
							/>
							<DateTimeSummaryCard
								label="Kết thúc"
								value={endsAt}
								active={activeSide === "end"}
								compact
								disabled={disabled}
								error={activeEndError}
								defaultTime="17:00"
								onFocus={() => setActiveSide("end")}
								onTimeChange={(time) =>
									onEndChange(
										composeDateTime(getDatePart(endsAt) || toLocalDateKey(monthDate), time)
									)
								}
							/>
						</div>
					</div>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
						>
							Hoàn tất
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

interface SoftSingleDateTimePickerProps {
	title: string;
	value: string;
	disabled?: boolean;
	error?: string;
	defaultTime?: string;
	minValue?: string;
	maxValue?: string;
	optional?: boolean;
	onChange: (value: string) => void;
}

function SoftSingleDateTimePicker({
	title,
	value,
	disabled = false,
	error,
	defaultTime = DEFAULT_DATE_TIME,
	minValue = "",
	maxValue = "",
	optional = false,
	onChange,
}: SoftSingleDateTimePickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [monthDate, setMonthDate] = useState(() => makeInitialMonth(value));
	const popoverRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: PointerEvent) => {
			if (!popoverRef.current?.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen]);

	const updateMonth = (direction: number) => {
		setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
	};

	return (
		<div ref={popoverRef} className="relative">
			<div className="block text-sm font-bold text-[#34483b]">
				<span>{title}</span>
				<button
					type="button"
					disabled={disabled}
					aria-expanded={isOpen}
					aria-label={`Mở ${title.toLowerCase()}`}
					onClick={() => setIsOpen((current) => !current)}
					className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#10221b] outline-none transition hover:border-[#9db6a3] focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]"
				>
					<span className={value ? "" : "text-[#7b8c82]"}>
						{formatDateTimeField(value, `Chọn ${title.toLowerCase()}`)}
					</span>
					<CalendarDays className="size-4 shrink-0 text-[#607368]" />
				</button>
			</div>
			{error && !isOpen && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
			{isOpen && (
				<div className="absolute left-0 right-0 z-30 mt-2 rounded-3xl border border-[#dce8dd] bg-[#f8fbf7] p-4 shadow-2xl">
					<p className="mb-3 text-xs font-semibold text-[#667a6d]">
						Chọn ngày trên lịch rồi tinh chỉnh giờ bên cạnh.
					</p>
					<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
						<SoftCalendar
							monthDate={monthDate}
							selectedStart={value}
							minValue={minValue}
							maxValue={maxValue}
							disabled={disabled}
							onPreviousMonth={() => updateMonth(-1)}
							onNextMonth={() => updateMonth(1)}
							onSelectDate={(dateKey) =>
								onChange(composeDateTime(dateKey, getTimePart(value, defaultTime)))
							}
						/>
						<DateTimeSummaryCard
							label={title}
							value={value}
							disabled={disabled}
							error={error}
							defaultTime={defaultTime}
							onTimeChange={(time) =>
								onChange(composeDateTime(getDatePart(value) || toLocalDateKey(monthDate), time))
							}
							onClear={optional ? () => onChange("") : undefined}
						/>
					</div>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={() => setIsOpen(false)}
							className="rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0f2e1c]"
						>
							Hoàn tất
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} phút`;
	const hours = Math.floor(minutes / 60);
	const remainingMinutes = minutes % 60;
	return remainingMinutes ? `${hours} giờ ${remainingMinutes} phút` : `${hours} giờ`;
}

function getMinimumTripDurationMinutes(route: CreatedTrekkingRoute): number {
	if (route.expectedDurationMinutes > 0) return route.expectedDurationMinutes;
	return Math.ceil(route.lengthMeters / MAX_REASONABLE_TREKKING_METERS_PER_MINUTE);
}

function getRouteDurationError(
	startsAt: string,
	endsAt: string,
	route: CreatedTrekkingRoute | null
): string {
	if (!route || !startsAt || !endsAt) return "";
	const startTime = new Date(startsAt).getTime();
	const endTime = new Date(endsAt).getTime();
	if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return "";
	const durationMinutes = Math.round((endTime - startTime) / 60_000);
	const minimumMinutes = getMinimumTripDurationMinutes(route);
	if (durationMinutes >= minimumMinutes) return "";
	const routeKilometers = (route.lengthMeters / 1000).toFixed(1);
	return `Thời lượng trip quá ngắn cho tuyến ${routeKilometers} km. Cần tối thiểu ${formatDuration(minimumMinutes)}.`;
}

function tripTypeLabel(startsAt: string, endsAt: string): string {
	return inferTripTypeFromSchedule(startsAt, endsAt) === "overnight" ? "Qua đêm" : "Trong ngày";
}

function isCreateTripFormValues(value: unknown): value is CreateTripFormValues {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<CreateTripFormValues>;
	return (
		typeof candidate.routeId === "string" &&
		typeof candidate.title === "string" &&
		typeof candidate.description === "string" &&
		typeof candidate.coverImageUrl === "string" &&
		typeof candidate.tripType === "string" &&
		typeof candidate.startsAt === "string" &&
		typeof candidate.endsAt === "string" &&
		typeof candidate.meetingLongitude === "string" &&
		typeof candidate.meetingLatitude === "string" &&
		typeof candidate.meetingAt === "string" &&
		typeof candidate.bookingDeadline === "string" &&
		typeof candidate.capacityMin === "string" &&
		typeof candidate.capacityMax === "string" &&
		typeof candidate.pricePerPerson === "string" &&
		Array.isArray(candidate.waypoints)
	);
}

function readPersistedDraft(storageKey: string | undefined): CreateTripFormValues | null {
	if (!storageKey || typeof window === "undefined") return null;
	try {
		const rawDraft = window.localStorage.getItem(storageKey);
		if (!rawDraft) return null;
		const parsed = JSON.parse(rawDraft) as unknown;
		return isCreateTripFormValues(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function persistDraft(storageKey: string | undefined, values: CreateTripFormValues): void {
	if (!storageKey || typeof window === "undefined") return;
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(values));
	} catch {
		// Draft persistence is best-effort; form submission remains authoritative.
	}
}

function clearPersistedDraft(storageKey: string | undefined): void {
	if (!storageKey || typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(storageKey);
	} catch {
		// Ignore storage cleanup failures.
	}
}

function isBlankOrDefault(value: string | undefined, defaultValue: string): boolean {
	return !value || value === defaultValue;
}

function useCurrentDateTimeLocalValue(): string {
	const [value, setValue] = useState(() => toDateTimeLocalInputValue(new Date()));

	useEffect(() => {
		const update = () => setValue(toDateTimeLocalInputValue(new Date()));
		const intervalId = window.setInterval(update, 15_000);
		document.addEventListener("visibilitychange", update);
		window.addEventListener("focus", update);
		return () => {
			window.clearInterval(intervalId);
			document.removeEventListener("visibilitychange", update);
			window.removeEventListener("focus", update);
		};
	}, []);

	return value;
}

function withRouteEndpointWaypoints(
	values: CreateTripFormValues,
	route: CreatedTrekkingRoute | null
): CreateTripFormValues {
	const start = route?.geometry.coordinates[0];
	const finish = route?.geometry.coordinates.at(-1);
	if (!route || !start || !finish) return values;
	const startWaypoint =
		values.waypoints.find((waypoint) => waypoint.type === "start") ?? values.waypoints[0];
	const finishWaypoint =
		values.waypoints.find((waypoint) => waypoint.type === "finish") ?? values.waypoints[1];
	return {
		...values,
		waypoints: [
			{
				type: "start",
				name: startWaypoint?.name || `${route.name} - điểm bắt đầu`,
				longitude: String(start[0]),
				latitude: String(start[1]),
				plannedAt: values.startsAt,
			},
			{
				type: "finish",
				name: finishWaypoint?.name || `${route.name} - điểm kết thúc`,
				longitude: String(finish[0]),
				latitude: String(finish[1]),
				plannedAt: values.endsAt,
			},
		],
	};
}

export function CreateTripForm({
	activeRoutes,
	isRouteLoading,
	routeError,
	isSubmitting,
	error,
	onSubmit,
	onRetry,
	onRetryRoutes,
	onCreateRoute,
	defaultValues = CREATE_TRIP_DEFAULT_VALUES,
	draftStorageKey,
	submitLabel = "Bước tiếp theo",
	submittingLabel = "Đang tạo trip...",
	title = "Thông tin chuyến đi",
	allowPastScheduleValues = false,
}: Props) {
	const formSchema = useMemo(
		() => createCreateTripFormSchema({ allowPastScheduleValues }),
		[allowPastScheduleValues]
	);
	const {
		register,
		handleSubmit,
		clearErrors,
		getValues,
		setError,
		setValue,
		trigger,
		watch,
		reset,
		formState: { errors },
	} = useForm<CreateTripFormValues>({
		resolver: zodResolver(formSchema),
		defaultValues,
		mode: "onChange",
	});
	const selectedRouteId = watch("routeId");
	const startsAt = watch("startsAt");
	const endsAt = watch("endsAt");
	const bookingDeadline = watch("bookingDeadline");
	const meetingAt = watch("meetingAt");
	const [coverImagePreview, setCoverImagePreview] = useState("");
	const minDateTime = useCurrentDateTimeLocalValue();
	const meetingAtMinDateTime = maxDateTimeLocalValue(bookingDeadline, minDateTime);
	const meetingLongitude = watch("meetingLongitude");
	const meetingLatitude = watch("meetingLatitude");
	const meetingPoint: Position | null =
		meetingLongitude && meetingLatitude
			? [Number(meetingLongitude), Number(meetingLatitude)]
			: null;
	const hasActiveRoutes = activeRoutes.length > 0;
	const selectedRoute = activeRoutes.find((route) => route.id === selectedRouteId) ?? null;
	const routeDurationError = getRouteDurationError(startsAt, endsAt, selectedRoute);
	const startsAtPastError = allowPastScheduleValues
		? undefined
		: getPastDateTimeMessage(startsAt, minDateTime, "Thời gian bắt đầu không được ở quá khứ");
	const endsAtPastError = allowPastScheduleValues
		? undefined
		: getPastDateTimeMessage(endsAt, minDateTime, "Thời gian kết thúc không được ở quá khứ");
	const bookingDeadlinePastError = allowPastScheduleValues
		? undefined
		: getPastDateTimeMessage(bookingDeadline, minDateTime, "Hạn đặt chỗ không được ở quá khứ");
	const meetingAtPastError = allowPastScheduleValues
		? undefined
		: getPastDateTimeMessage(meetingAt, minDateTime, "Thời gian tập trung không được ở quá khứ");
	const startsAtErrorMessage = errors.startsAt?.message || startsAtPastError;
	const endsAtErrorMessage = routeDurationError || errors.endsAt?.message || endsAtPastError;
	const bookingDeadlineErrorMessage = errors.bookingDeadline?.message || bookingDeadlinePastError;
	const meetingAtErrorMessage = errors.meetingAt?.message || meetingAtPastError;
	const routeSelectDisabled = isSubmitting || isRouteLoading || !hasActiveRoutes;
	const submitDisabled = isSubmitting || !hasActiveRoutes || !selectedRouteId;

	useEffect(() => {
		reset(readPersistedDraft(draftStorageKey) ?? defaultValues);
	}, [defaultValues, draftStorageKey, reset]);

	useEffect(() => {
		if (!draftStorageKey) return;
		const subscription = watch((values) => {
			if (isCreateTripFormValues(values)) persistDraft(draftStorageKey, values);
		});
		return () => subscription.unsubscribe();
	}, [draftStorageKey, watch]);

	useEffect(() => {
		if (!hasActiveRoutes || selectedRouteId) return;
		setValue("routeId", activeRoutes[0].id, { shouldValidate: true });
	}, [activeRoutes, hasActiveRoutes, selectedRouteId, setValue]);

	useEffect(() => {
		if (!selectedRoute) return;
		const currentValues = getValues();
		const start = selectedRoute.geometry.coordinates[0];
		const finish = selectedRoute.geometry.coordinates.at(-1);
		if (!start || !finish) return;
		setValue("waypoints.0.type", "start");
		if (!currentValues.waypoints[0]?.name) {
			setValue("waypoints.0.name", `${selectedRoute.name} - điểm bắt đầu`, {
				shouldValidate: true,
			});
		}
		if (
			isBlankOrDefault(
				currentValues.waypoints[0]?.longitude,
				CREATE_TRIP_DEFAULT_VALUES.waypoints[0].longitude
			) ||
			isBlankOrDefault(
				currentValues.waypoints[0]?.latitude,
				CREATE_TRIP_DEFAULT_VALUES.waypoints[0].latitude
			)
		) {
			setValue("waypoints.0.longitude", String(start[0]), {
				shouldValidate: true,
			});
			setValue("waypoints.0.latitude", String(start[1]), {
				shouldValidate: true,
			});
		}
		setValue("waypoints.1.type", "finish");
		if (!currentValues.waypoints[1]?.name) {
			setValue("waypoints.1.name", `${selectedRoute.name} - điểm kết thúc`, {
				shouldValidate: true,
			});
		}
		if (
			isBlankOrDefault(
				currentValues.waypoints[1]?.longitude,
				CREATE_TRIP_DEFAULT_VALUES.waypoints[1].longitude
			) ||
			isBlankOrDefault(
				currentValues.waypoints[1]?.latitude,
				CREATE_TRIP_DEFAULT_VALUES.waypoints[1].latitude
			)
		) {
			setValue("waypoints.1.longitude", String(finish[0]), {
				shouldValidate: true,
			});
			setValue("waypoints.1.latitude", String(finish[1]), {
				shouldValidate: true,
			});
		}
	}, [getValues, selectedRoute, setValue]);

	useEffect(() => {
		if (startsAt) setValue("waypoints.0.plannedAt", startsAt, { shouldValidate: true });
	}, [setValue, startsAt]);

	useEffect(() => {
		if (endsAt) setValue("waypoints.1.plannedAt", endsAt, { shouldValidate: true });
	}, [endsAt, setValue]);

	useEffect(() => {
		setValue("tripType", inferTripTypeFromSchedule(startsAt, endsAt), {
			shouldValidate: true,
		});
	}, [endsAt, setValue, startsAt]);

	useEffect(() => {
		if (routeDurationError) {
			setError("endsAt", {
				type: "routeDuration",
				message: routeDurationError,
			});
			return;
		}
		if (errors.endsAt?.type === "routeDuration") clearErrors("endsAt");
	}, [clearErrors, errors.endsAt?.type, routeDurationError, setError]);

	const setMeetingPoint = useCallback(
		([longitude, latitude]: Position) => {
			setValue("meetingLongitude", String(longitude), {
				shouldValidate: true,
				shouldDirty: true,
			});
			setValue("meetingLatitude", String(latitude), {
				shouldValidate: true,
				shouldDirty: true,
			});
		},
		[setValue]
	);

	const handleCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setError("coverImageUrl", { message: "Ảnh bìa phải là file hình ảnh" });
			event.target.value = "";
			return;
		}
		if (file.size > MAX_COVER_IMAGE_SIZE) {
			setError("coverImageUrl", {
				message: "Ảnh bìa không được vượt quá 5 MB",
			});
			event.target.value = "";
			return;
		}
		clearErrors("coverImageUrl");
		setValue("coverImageUrl", "", { shouldValidate: true });
		setCoverImagePreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return URL.createObjectURL(file);
		});
	};

	const clearCoverImage = () => {
		setCoverImagePreview((current) => {
			if (current) URL.revokeObjectURL(current);
			return "";
		});
		clearErrors("coverImageUrl");
		setValue("coverImageUrl", "", { shouldValidate: true });
	};

	useEffect(
		() => () => {
			if (coverImagePreview) URL.revokeObjectURL(coverImagePreview);
		},
		[coverImagePreview]
	);

	useEffect(() => {
		if (!error) return;
		for (const [field, message] of Object.entries(error.fieldErrors)) {
			const mapped = backendFieldMap[field];
			if (mapped) setError(mapped, { message });
			if (field.startsWith("waypoints.")) setError("waypoints", { message });
		}
	}, [error, setError]);

	const submitForm = (values: CreateTripFormValues) => {
		const durationError = getRouteDurationError(values.startsAt, values.endsAt, selectedRoute);
		if (durationError) {
			setError("endsAt", { type: "routeDuration", message: durationError });
			return Promise.resolve();
		}
		return onSubmit(toCreateTripInput(withRouteEndpointWaypoints(values, selectedRoute))).then(
			(result) => {
				if (result) clearPersistedDraft(draftStorageKey);
				return result;
			}
		);
	};

	return (
		<form className="grid gap-5" noValidate onSubmit={handleSubmit(submitForm)}>
			<section className="overflow-hidden rounded-2xl border border-[#dce8dd] bg-white shadow-sm">
				<div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
					<div className="bg-[#f7faf6] p-5">
						<div className="flex items-start gap-3">
							<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-[#164027]">
								<Route className="size-5" />
							</div>
							<div>
								<p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#728578]">
									Tuyến trekking
								</p>
								<h2 className="mt-1 text-lg font-extrabold text-[#10221b]">
									Chọn tuyến đã duyệt để tạo trip
								</h2>
								<p className="mt-2 text-sm leading-6 text-[#667a6d]">
									Chuyến đi dùng tuyến trekking có sẵn. Điểm bắt đầu và kết thúc sẽ tự lấy từ tuyến
									bạn chọn.
								</p>
							</div>
						</div>
						{!isRouteLoading && !routeError && !hasActiveRoutes && onCreateRoute && (
							<button
								type="button"
								onClick={onCreateRoute}
								className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-4 py-2.5 text-sm font-bold text-white"
							>
								Tạo tuyến trekking
								<ArrowRight className="size-4" />
							</button>
						)}
					</div>
					<div className="p-5">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<label className="flex-1 text-sm font-bold text-[#34483b]">
								Tuyến đã duyệt
								<select
									aria-label="Tuyến đã duyệt"
									disabled={routeSelectDisabled}
									className={inputClass}
									{...register("routeId")}
								>
									<option value="">
										{isRouteLoading ? "Đang tải tuyến..." : "Chọn tuyến đã duyệt"}
									</option>
									{activeRoutes.map((route) => (
										<option key={route.id} value={route.id}>
											{route.name}
										</option>
									))}
								</select>
								{errors.routeId && (
									<span className="mt-1 block text-xs text-red-600">{errors.routeId.message}</span>
								)}
							</label>
							<button
								type="button"
								onClick={onRetryRoutes}
								disabled={isRouteLoading}
								className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#cbd9ce] px-3 py-2.5 text-sm font-bold text-[#164027] disabled:opacity-60"
							>
								<RefreshCw className={`size-4 ${isRouteLoading ? "animate-spin" : ""}`} />
								Tải lại tuyến
							</button>
						</div>
					</div>
				</div>
				{routeError && (
					<p
						role="alert"
						className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
					>
						{routeError}
					</p>
				)}
				{!isRouteLoading && !routeError && !hasActiveRoutes && (
					<p
						role="alert"
						className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
					>
						Chưa có tuyến trekking đã duyệt. Form vẫn cho nhập nháp; nút tạo chuyến đi sẽ mở sau khi
						có tuyến phù hợp.
					</p>
				)}
			</section>

			<input type="hidden" {...register("meetingLongitude")} />
			<input type="hidden" {...register("meetingLatitude")} />
			<input type="hidden" {...register("tripType")} />
			<input type="hidden" {...register("waypoints.0.type")} />
			<input type="hidden" {...register("waypoints.0.name")} />
			<input type="hidden" {...register("waypoints.0.longitude")} />
			<input type="hidden" {...register("waypoints.0.latitude")} />
			<input type="hidden" {...register("waypoints.0.plannedAt")} />
			<input type="hidden" {...register("waypoints.1.type")} />
			<input type="hidden" {...register("waypoints.1.name")} />
			<input type="hidden" {...register("waypoints.1.longitude")} />
			<input type="hidden" {...register("waypoints.1.latitude")} />
			<input type="hidden" {...register("waypoints.1.plannedAt")} />

			<section className="rounded-2xl border border-[#e0ebe0] bg-white p-5 shadow-sm">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h2 className="font-extrabold text-[#10221b]">{title}</h2>
					</div>
					<div className="inline-flex items-center gap-2 self-start rounded-full bg-[#f0f6ef] px-4 py-2 text-sm font-extrabold text-[#164027]">
						<CalendarDays className="size-4" />
						{tripTypeLabel(startsAt, endsAt)}
					</div>
				</div>
				<div className="mt-4 grid gap-4 sm:grid-cols-2">
					<label className="text-sm font-bold text-[#34483b] sm:col-span-2">
						Tên trip
						<input
							aria-label="Tên trip"
							disabled={isSubmitting}
							maxLength={150}
							className={inputClass}
							{...register("title")}
						/>
						{errors.title && (
							<span className="mt-1 block text-xs text-red-600">{errors.title.message}</span>
						)}
					</label>
					<div>
						<SoftDateTimeRangePicker
							title="Thời gian"
							startsAt={startsAt}
							endsAt={endsAt}
							minValue={minDateTime}
							disabled={isSubmitting}
							startError={startsAtErrorMessage}
							endError={endsAtErrorMessage}
							onStartChange={(value) => {
								setValue("startsAt", value, {
									shouldValidate: true,
									shouldDirty: true,
								});
								void trigger(["startsAt", "endsAt", "meetingAt", "bookingDeadline"]);
							}}
							onEndChange={(value) => {
								setValue("endsAt", value, {
									shouldValidate: true,
									shouldDirty: true,
								});
								void trigger(["startsAt", "endsAt"]);
							}}
						/>
						<input
							aria-label="Bắt đầu"
							type="datetime-local"
							min={minDateTime}
							disabled={isSubmitting}
							className="sr-only"
							{...register("startsAt")}
						/>
						<input
							aria-label="Kết thúc"
							type="datetime-local"
							min={startsAt || minDateTime}
							disabled={isSubmitting}
							className="sr-only"
							{...register("endsAt")}
						/>
					</div>
					<label className="text-sm font-bold text-[#34483b]">
						Giá mỗi người
						<input
							aria-label="Giá mỗi người"
							inputMode="decimal"
							disabled={isSubmitting}
							className={inputClass}
							{...register("pricePerPerson")}
						/>
						{errors.pricePerPerson && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.pricePerPerson.message}
							</span>
						)}
					</label>
					<div className="sm:col-span-2 grid gap-4 xl:grid-cols-2">
						<div>
							<SoftSingleDateTimePicker
								title="Thời gian tập trung"
								value={meetingAt}
								disabled={isSubmitting}
								error={meetingAtErrorMessage}
								defaultTime="07:30"
								minValue={meetingAtMinDateTime}
								maxValue={startsAt}
								optional
								onChange={(value) =>
									setValue("meetingAt", value, {
										shouldValidate: true,
										shouldDirty: true,
									})
								}
							/>
							<input
								aria-label="Thời gian tập trung"
								type="datetime-local"
								min={meetingAtMinDateTime}
								max={startsAt || undefined}
								disabled={isSubmitting}
								className="sr-only"
								{...register("meetingAt")}
							/>
						</div>
						<div>
							<SoftSingleDateTimePicker
								title="Hạn đặt chỗ"
								value={bookingDeadline}
								disabled={isSubmitting}
								error={bookingDeadlineErrorMessage}
								defaultTime="18:00"
								minValue={minDateTime}
								maxValue={startsAt}
								onChange={(value) => {
									setValue("bookingDeadline", value, {
										shouldValidate: true,
										shouldDirty: true,
									});
									void trigger(["bookingDeadline", "meetingAt"]);
								}}
							/>
							<input
								aria-label="Hạn đặt chỗ"
								type="datetime-local"
								min={minDateTime}
								max={startsAt || undefined}
								disabled={isSubmitting}
								className="sr-only"
								{...register("bookingDeadline")}
							/>
						</div>
					</div>
					<label className="text-sm font-bold text-[#34483b]">
						Số khách tối thiểu
						<input
							aria-label="Số khách tối thiểu"
							inputMode="numeric"
							disabled={isSubmitting}
							className={inputClass}
							{...register("capacityMin")}
						/>
						{errors.capacityMin && (
							<span className="mt-1 block text-xs text-red-600">{errors.capacityMin.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Số khách tối đa
						<input
							aria-label="Số khách tối đa"
							inputMode="numeric"
							placeholder="Không giới hạn"
							disabled={isSubmitting}
							className={inputClass}
							{...register("capacityMax")}
						/>
						{errors.capacityMax && (
							<span className="mt-1 block text-xs text-red-600">{errors.capacityMax.message}</span>
						)}
					</label>
					<label className="text-sm font-bold text-[#34483b]">
						Mô tả
						<textarea
							aria-label="Mô tả"
							disabled={isSubmitting}
							rows={5}
							className={inputClass}
							{...register("description")}
						/>
					</label>
					<div className="text-sm font-bold text-[#34483b]">
						<span>Ảnh bìa</span>
						<input type="hidden" {...register("coverImageUrl")} />
						<div className="mt-1 rounded-xl border border-dashed border-[#16a34a]/35 bg-[#fbfdfb] p-3">
							{coverImagePreview ? (
								<div className="relative overflow-hidden rounded-lg">
									<img
										src={coverImagePreview}
										alt="Ảnh bìa đã chọn"
										className="h-36 w-full object-cover"
									/>
									<button
										type="button"
										aria-label="Bỏ ảnh bìa"
										onClick={clearCoverImage}
										disabled={isSubmitting}
										className="absolute top-2 right-2 rounded-full bg-white p-1.5 text-[#164027] shadow"
									>
										<X className="size-4" />
									</button>
								</div>
							) : (
								<label className="flex min-h-36 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-5 text-sm font-bold text-[#164027] ring-1 ring-[#16a34a]/25">
									<ImagePlus className="size-4" />
									Chọn ảnh từ máy
									<input
										aria-label="Ảnh bìa"
										type="file"
										accept="image/*"
										disabled={isSubmitting}
										onChange={handleCoverImageChange}
										className="sr-only"
									/>
								</label>
							)}
							<p className="mt-2 text-xs font-medium text-[#667a6d]">
								Hỗ trợ JPG, PNG hoặc WebP, tối đa 5 MB.
							</p>
						</div>
						{errors.coverImageUrl && (
							<span className="mt-1 block text-xs text-red-600">
								{errors.coverImageUrl.message}
							</span>
						)}
					</div>
				</div>
			</section>

			<TripRouteMap
				route={selectedRoute}
				meetingPoint={meetingPoint}
				disabled={isSubmitting}
				onMeetingPointChange={setMeetingPoint}
			/>

			{(errors.meetingLongitude ||
				errors.meetingLatitude ||
				errors.waypoints?.message ||
				errors.waypoints?.root) && (
				<p role="alert" className="text-sm font-bold text-red-600">
					{errors.meetingLongitude?.message ??
						errors.meetingLatitude?.message ??
						errors.waypoints?.message ??
						errors.waypoints?.root?.message ??
						"Vui lòng kiểm tra các điểm trên tuyến."}
				</p>
			)}

			{error && (
				<div
					role="alert"
					className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
				>
					<div className="flex gap-2">
						<AlertCircle className="size-5 shrink-0" />
						<span>{error.message}</span>
					</div>
					{error.canRetry && (
						<button
							type="button"
							onClick={() => void onRetry()}
							className="mt-3 rounded-lg border border-red-300 px-3 py-2 font-bold"
						>
							<RefreshCw className="mr-1 inline size-4" />
							Thử lại
						</button>
					)}
				</div>
			)}

			<button
				type="submit"
				disabled={submitDisabled}
				className="flex items-center justify-center gap-2 rounded-xl bg-[#164027] px-5 py-3 font-bold text-white disabled:opacity-60"
			>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting
					? submittingLabel
					: hasActiveRoutes
						? submitLabel
						: "Cần tuyến đã duyệt để tạo trip"}
			</button>
		</form>
	);
}
