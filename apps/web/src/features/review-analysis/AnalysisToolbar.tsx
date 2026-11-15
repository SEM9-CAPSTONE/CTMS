import { Check, ChevronDown, Loader2, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { buttonClass } from "./constants";
import type { TripList } from "./types";

const TRIP_PICKER_PAGE_SIZE = 6;
interface Props {
	trips?: TripList;
	loading: boolean;
	error: string | null;
	tripId: string;
	canLoadMoreTrips: boolean;
	loadingMoreTrips: boolean;
	busy: boolean;
	running: boolean;
	refreshing: boolean;
	waitSeconds: number;
	canCreate: boolean;
	hasMore: boolean;
	onChoose: (id: string) => void;
	onLoadMoreTrips: () => void;
	onRetry: () => void;
	onRefresh: () => void;
	onCreate: () => void;
}
export function AnalysisToolbar(props: Props) {
	const { trips, tripId } = props;
	const [search, setSearch] = useState("");
	const [pageIndex, setPageIndex] = useState(0);
	const picker = useRef<HTMLDetailsElement>(null);
	const searchInput = useRef<HTMLInputElement>(null);
	const trigger = useRef<HTMLElement>(null);
	const closePicker = () => {
		if (picker.current) picker.current.open = false;
		trigger.current?.focus();
	};
	const items = trips?.items ?? [];
	const normalizeTripName = (name: string) =>
		name.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replaceAll("đ", "d");
	const term = normalizeTripName(search.trim());
	const matchingTrips = items.filter((trip) => normalizeTripName(trip.title).includes(term));
	const lastLoadedPage = Math.max(0, Math.ceil(matchingTrips.length / TRIP_PICKER_PAGE_SIZE) - 1);
	const page = Math.min(pageIndex, lastLoadedPage);
	const previousUnavailable = page === 0 || props.loadingMoreTrips;
	const nextUnavailable =
		props.loadingMoreTrips || (page === lastLoadedPage && !props.canLoadMoreTrips);
	const visibleTrips = matchingTrips.slice(
		page * TRIP_PICKER_PAGE_SIZE,
		(page + 1) * TRIP_PICKER_PAGE_SIZE
	);
	const selectedTitle = items.find((trip) => trip.id === tripId)?.title;
	const selectedElsewhere = selectedTitle && !visibleTrips.some((trip) => trip.id === tripId);
	const label = props.busy
		? "Đang gửi…"
		: props.running
			? "Đang phân tích…"
			: props.waitSeconds
				? `Chờ ${props.waitSeconds} giây`
				: props.hasMore
					? "Phân tích lượt tiếp theo"
					: "Phân tích đánh giá";
	return (
		<section
			className="rounded-2xl border border-[#dfe8df] bg-white p-4 sm:p-5"
			aria-label="Chọn chuyến đi và phân tích"
		>
			<div className="flex flex-col gap-3 md:flex-row md:items-end">
				<div className="min-w-0 flex-1">
					<span className="mb-2 block text-sm font-semibold">Chuyến đi</span>
					{props.error ? (
						<div role="alert" className="text-sm">
							<p>{props.error}</p>
							<button type="button" className="mt-2 underline" onClick={props.onRetry}>
								Thử lại
							</button>
						</div>
					) : (
						<details
							ref={picker}
							className="relative"
							onBlur={(event) => {
								if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))
									event.currentTarget.open = false;
							}}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									event.preventDefault();
									closePicker();
								}
								if (!event.currentTarget.open || !["ArrowDown", "ArrowUp"].includes(event.key))
									return;
								const options = Array.from(
									event.currentTarget.querySelectorAll<HTMLButtonElement>(
										"ul button:not(:disabled)"
									)
								);
								if (!options.length) return;
								const current = options.findIndex((option) => option === document.activeElement);
								const step = event.key === "ArrowDown" ? 1 : -1;
								const next =
									current < 0
										? step > 0
											? 0
											: options.length - 1
										: (current + step + options.length) % options.length;
								event.preventDefault();
								options[next]?.focus();
							}}
						>
							<summary
								id="analysis-trip"
								ref={trigger}
								className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[#dbe4d6] bg-white px-3 text-sm focus-visible:outline-[#456d37]"
							>
								<span className="truncate">
									{props.loading
										? "Đang tải chuyến đi…"
										: (selectedTitle ?? "Chọn chuyến đi để xem đánh giá")}
								</span>
								<ChevronDown aria-hidden="true" className="size-4 shrink-0" />
							</summary>
							<div className="absolute left-0 top-full z-40 mt-2 w-full max-w-lg overflow-hidden rounded-xl border border-[#dfe8df] bg-white shadow-sm">
								<div className="flex items-center gap-2 border-b border-[#dfe8df] px-3 py-2 text-[#55685a]">
									<Search className="size-4 shrink-0" aria-hidden="true" />
									<input
										type="search"
										ref={searchInput}
										value={search}
										onChange={(event) => {
											setSearch(event.target.value);
											setPageIndex(0);
										}}
										aria-label="Tìm chuyến đi theo tên"
										placeholder="Tìm chuyến đi theo tên"
										className="min-h-9 min-w-0 flex-1 rounded-md px-2 text-sm text-[#10221b] focus-visible:outline-[#164027]"
									/>
									{search && (
										<button
											type="button"
											className="shrink-0 rounded px-2 py-1 text-sm font-medium text-[#164027] hover:bg-[#edf3ed]"
											onClick={() => {
												searchInput.current?.focus();
												setSearch("");
												setPageIndex(0);
											}}
										>
											Xóa từ khóa
										</button>
									)}
									<button
										type="button"
										aria-label="Đóng danh sách chuyến đi"
										title="Đóng"
										onClick={closePicker}
										className="grid size-9 shrink-0 place-items-center rounded-lg text-[#55685a] hover:bg-[#edf3ed] focus-visible:outline-[#164027]"
									>
										<X className="size-4" aria-hidden="true" />
									</button>
								</div>
								<p
									aria-live="polite"
									className={`border-b border-[#dfe8df] px-3 py-2 text-xs text-[#55685a] ${selectedTitle ? "min-h-12" : "min-h-9"}`}
								>
									{term
										? `${matchingTrips.length} kết quả${props.canLoadMoreTrips ? " trong danh sách đã tải" : ""}`
										: `${trips?.pagination.total ?? items.length} chuyến đi`}
									{selectedElsewhere && (
										<span className="block truncate font-semibold text-[#164027]">
											Đang chọn: {selectedTitle}
										</span>
									)}
								</p>
								<div className="h-64 overflow-y-auto overscroll-contain p-2" key={page}>
									<ul className="space-y-1">
										{visibleTrips.map((trip) => (
											<li key={trip.id}>
												<button
													type="button"
													aria-pressed={tripId === trip.id}
													disabled={props.busy || props.loadingMoreTrips}
													className="flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors hover:bg-[#f4f7f2] focus-visible:outline focus-visible:outline-[#164027] aria-pressed:bg-[#edf3ed] aria-pressed:font-semibold"
													onClick={() => {
														props.onChoose(trip.id);
														closePicker();
													}}
												>
													<span className="min-w-0 truncate" title={trip.title}>
														{trip.title}
													</span>
													{tripId === trip.id && (
														<Check aria-hidden="true" className="size-4 shrink-0 text-[#164027]" />
													)}
												</button>
											</li>
										))}
									</ul>
									{visibleTrips.length === 0 && (
										<p className="px-3 py-2 text-sm text-[#55685a]">
											{props.canLoadMoreTrips
												? "Không tìm thấy chuyến đi trong danh sách đã tải."
												: "Không tìm thấy chuyến đi."}
										</p>
									)}
								</div>
								{(lastLoadedPage > 0 || props.canLoadMoreTrips || props.loadingMoreTrips) && (
									<nav
										aria-label="Trang danh sách chuyến đi"
										className="flex items-center justify-end gap-2 border-t border-[#dfe8df] bg-[#f7faf6] p-2 text-sm text-[#164027]"
									>
										<button
											type="button"
											className="rounded-lg px-3 py-2 font-semibold hover:bg-[#edf3ed] aria-disabled:cursor-default aria-disabled:text-[#55685a]"
											aria-disabled={previousUnavailable}
											onClick={() => {
												if (previousUnavailable) return;
												searchInput.current?.focus({ preventScroll: true });
												setPageIndex(page - 1);
											}}
										>
											Trước
										</button>
										<span aria-live="polite" className="px-2 tabular-nums">
											Trang {page + 1}
										</span>
										<button
											type="button"
											aria-disabled={nextUnavailable}
											className="rounded-lg px-3 py-2 font-semibold hover:bg-[#edf3ed] disabled:opacity-60"
											onClick={() => {
												if (nextUnavailable) return;
												searchInput.current?.focus({ preventScroll: true });
												setPageIndex(matchingTrips.length ? page + 1 : 0);
												if (page === lastLoadedPage) props.onLoadMoreTrips();
											}}
										>
											{props.loadingMoreTrips ? "Đang tải…" : "Tiếp theo"}
										</button>
									</nav>
								)}
							</div>
						</details>
					)}
				</div>
				<div className="flex shrink-0 gap-2">
					<button
						type="button"
						aria-label="Làm mới phân tích"
						title="Làm mới phân tích"
						className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dbe4d6] px-3 text-sm disabled:opacity-40"
						disabled={!tripId || props.refreshing}
						onClick={props.onRefresh}
					>
						<RefreshCw className={`size-4 ${props.refreshing ? "animate-spin" : ""}`} />
						<span className="md:hidden">Làm mới</span>
					</button>
					<button
						type="button"
						className={`${buttonClass} min-h-11 flex-1 md:flex-none`}
						disabled={!props.canCreate}
						onClick={props.onCreate}
					>
						{props.busy || props.running ? (
							<Loader2 className="size-4 animate-spin text-white" />
						) : (
							<Sparkles className="size-4" />
						)}
						{label}
					</button>
				</div>
			</div>
			<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#728070]">
				<p>Mỗi lượt tối đa 20 nhận xét · Các lượt cách nhau ít nhất 1 phút.</p>
				<p className="text-[#55685a]">
					{!selectedTitle && !tripId
						? "Chọn chuyến đi trước."
						: !props.canCreate && !props.busy && !props.running && !props.waitSeconds
							? "Hiện chưa thể bắt đầu lượt phân tích mới."
							: null}
				</p>
			</div>
			{trips?.items.length === 0 && (
				<p className="mt-3 text-sm text-[#728070]">
					Chưa có chuyến đi trong phạm vi tài khoản của bạn.
				</p>
			)}
		</section>
	);
}
