import { CalendarDays, ChevronLeft, ChevronRight, Clock3, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DEFAULT_DATE_TIME = "08:00";
type RangeSide = "start" | "end";

export function toDateTimeLocalInputValue(date: Date): string {
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
function getDateTimeRangeError(
	value: string,
	minValue: string,
	maxValue: string
): string | undefined {
	const selected = getDateTimeDate(value);
	if (!selected) return undefined;

	const min = getDateTimeDate(minValue);
	const max = getDateTimeDate(maxValue);

	if (min && selected < min) {
		return `Thời gian phải từ ${formatDateTimeField(minValue)} trở đi`;
	}

	if (max && selected > max) {
		return `Thời gian không được sau ${formatDateTimeField(maxValue)}`;
	}

	return undefined;
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
export function maxDateTimeLocalValue(...values: string[]): string {
	return values
		.filter(Boolean)
		.reduce(
			(maximum, value) =>
				!maximum || compareDateTimeLocalValues(value, maximum) > 0 ? value : maximum,
			""
		);
}
export function getPastDateTimeMessage(
	value: string,
	minimum: string,
	message: string
): string | undefined {
	if (!value || !minimum) return undefined;
	return compareDateTimeLocalValues(value, minimum) <= 0 ? message : undefined;
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
							disabled={disabled || isOutOfRange}
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
export function SoftDateTimeRangePicker({
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
	const activeStartError = startError;
	const activeEndError = endError;
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
			{(startError || endError) && (
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
	modal?: boolean;
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
export function SoftSingleDateTimePicker({
	title,
	value,
	disabled = false,
	error,
	defaultTime = DEFAULT_DATE_TIME,
	minValue = "",
	maxValue = "",
	optional = false,
	modal = false,
	onChange,
}: SoftSingleDateTimePickerProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [monthDate, setMonthDate] = useState(() => makeInitialMonth(value, minValue));
	const popoverRef = useRef<HTMLDivElement | null>(null);
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const rangeError = getDateTimeRangeError(value, minValue, maxValue);
	const displayedError = rangeError || error;
	useEffect(() => {
		if (!isOpen) return;
		const handlePointerDown = (event: PointerEvent) => {
			if (
				!popoverRef.current?.contains(event.target as Node) &&
				!dialogRef.current?.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};
		document.addEventListener("pointerdown", handlePointerDown);
		return () => document.removeEventListener("pointerdown", handlePointerDown);
	}, [isOpen]);
	const updateMonth = (direction: number) => {
		setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + direction, 1));
	};
	const pickerContent = (
		<div
			ref={dialogRef}
			className={
				modal
					? "w-full max-w-[650px] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-[#dce8dd] bg-[#f8fbf7] p-4 shadow-2xl"
					: "absolute left-0 right-0 z-30 mt-2 rounded-3xl border border-[#dce8dd] bg-[#f8fbf7] p-4 shadow-2xl"
			}
		>
			<p className="mb-3 text-xs font-semibold text-[#667a6d]">
				Chọn ngày trên lịch rồi tinh chỉnh giờ bên cạnh.
			</p>
			<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
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
					error={displayedError}
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
	);

	return (
		<div ref={popoverRef} className="relative">
			<div className="block text-sm font-bold text-[#34483b]">
				<span>{title}</span>
				<button
					type="button"
					disabled={disabled}
					aria-expanded={isOpen}
					aria-label={`Mở ${title.toLowerCase()}`}
					onClick={() => {
						if (!isOpen) setMonthDate(makeInitialMonth(value, minValue));
						setIsOpen((current) => !current);
					}}
					className="mt-1 flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#cbd9ce] bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#10221b] outline-none transition hover:border-[#9db6a3] focus:border-[#164027] focus:ring-2 focus:ring-[#164027]/10 disabled:bg-[#f4f7f2] disabled:text-[#7b8c82]"
				>
					<span className={value ? "" : "text-[#7b8c82]"}>
						{formatDateTimeField(value, `Chọn ${title.toLowerCase()}`)}
					</span>
					<CalendarDays className="size-4 shrink-0 text-[#607368]" />
				</button>
			</div>
			{displayedError && (
				<p role="alert" className="mt-1 text-xs font-semibold text-red-600">
					{displayedError}
				</p>
			)}
			{isOpen &&
				(modal
					? createPortal(
							<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 p-3">
								{pickerContent}
							</div>,
							document.body
						)
					: pickerContent)}
		</div>
	);
}
