import { RefreshCw, Sparkles } from "lucide-react";
import { buttonClass } from "./constants";
import type { TripList } from "./types";
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
	const selected = trips?.items.some((t) => t.id === tripId);
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
					<label htmlFor="analysis-trip" className="mb-2 block text-sm font-semibold">
						Chuyến đi
					</label>
					{props.error ? (
						<div role="alert" className="text-sm">
							<p>{props.error}</p>
							<button type="button" className="mt-2 underline" onClick={props.onRetry}>
								Thử lại
							</button>
						</div>
					) : (
						<select
							id="analysis-trip"
							value={tripId}
							onChange={(e) => {
								if (e.target.value === "load-more-trips") props.onLoadMoreTrips();
								else props.onChoose(e.target.value);
							}}
							disabled={props.loading || props.busy || props.loadingMoreTrips}
							className="min-h-11 w-full rounded-xl border border-[#dbe4d6] bg-white px-3 text-sm focus:outline-[#456d37]"
						>
							<option value="">
								{props.loading ? "Đang tải chuyến đi…" : "Chọn chuyến đi để xem đánh giá"}
							</option>
							{tripId && !selected && <option value={tripId}>Chuyến đi đã chọn</option>}
							{trips?.items.map((t) => (
								<option key={t.id} value={t.id}>
									{t.title}
								</option>
							))}
							{props.canLoadMoreTrips && (
								<option value="load-more-trips">Tải thêm chuyến đi…</option>
							)}
						</select>
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
						<Sparkles className="size-4" />
						{label}
					</button>
				</div>
			</div>
			<div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#728070]">
				<p>Mỗi lượt tối đa 20 nhận xét · Các lượt cách nhau ít nhất 1 phút.</p>
			</div>
			{trips?.items.length === 0 && (
				<p className="mt-3 text-sm text-[#728070]">
					Chưa có chuyến đi trong phạm vi tài khoản của bạn.
				</p>
			)}
		</section>
	);
}
