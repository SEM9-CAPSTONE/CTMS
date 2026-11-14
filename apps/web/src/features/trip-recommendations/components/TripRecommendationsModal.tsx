import { Compass, Loader2, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { TripCard } from "../../trips/components/TripCard";
import { useTripPreferences, useTripRecommendations } from "../hooks/useTripRecommendations";
import { recommendationReasonLabels } from "../reasons";
import type { TripPreferences } from "../types";
import {
	DIFFICULTY_OPTIONS,
	TRIP_TYPE_OPTIONS,
	TripPreferencesForm,
	formatPriceRange,
} from "./TripPreferencesForm";

export interface TripRecommendationsBannerProps {
	onSelectTrip: (tripId: string) => void;
}

/**
 * "Gợi ý chuyến đi" banner for Explore. Nothing is generated until the Camper opens the modal;
 * each opening asks the server again (which reuses its AI order while the profile is unchanged).
 */
export function TripRecommendationsBanner({ onSelectTrip }: TripRecommendationsBannerProps) {
	const [isOpen, setOpen] = useState(false);
	return (
		<>
			<section
				aria-labelledby="trip-recommendations-banner-title"
				className="relative overflow-hidden rounded-[24px] border border-[#cfe0cf] bg-gradient-to-r from-[#164027] via-[#1d5233] to-[#2c6b45] p-5 text-white shadow-sm sm:p-6"
			>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/10"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -bottom-16 right-24 size-36 rounded-full bg-white/5"
				/>
				<div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-start gap-3">
						<div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15">
							<Sparkles className="size-5" />
						</div>
						<div>
							<h2
								id="trip-recommendations-banner-title"
								className="text-base font-extrabold tracking-tight sm:text-lg"
							>
								Gợi ý chuyến đi dành cho bạn
							</h2>
							<p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-[#d7eadb] sm:text-sm">
								Dựa trên sở thích, thể lực và những chuyến bạn đã đi. Mỗi gợi ý kèm lý do vì sao phù
								hợp với bạn.
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setOpen(true)}
						className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#164027] shadow-sm transition hover:bg-[#eef5ee] sm:self-center"
					>
						<Sparkles className="size-4" />
						Xem gợi ý
					</button>
				</div>
			</section>
			{isOpen && (
				<TripRecommendationsModal
					onClose={() => setOpen(false)}
					onSelectTrip={(tripId) => {
						setOpen(false);
						onSelectTrip(tripId);
					}}
				/>
			)}
		</>
	);
}

function preferenceChips(preferences: TripPreferences): string[] {
	const label = <T extends string>(options: Array<{ value: T; label: string }>, value: T) =>
		options.find((option) => option.value === value)?.label ?? value;
	const price = formatPriceRange(preferences.minPrice, preferences.maxPrice);
	return [
		...preferences.tripTypes.map((value) => label(TRIP_TYPE_OPTIONS, value)),
		...preferences.difficulties.map((value) => `Độ khó ${label(DIFFICULTY_OPTIONS, value)}`),
		...preferences.regions.map(
			(code) => preferences.regionOptions.find((region) => region.code === code)?.label ?? code
		),
		...(price ? [price] : []),
	];
}

/**
 * What the suggestions are based on, at the top of the modal. Preferences only move matching
 * Trips up; they never hide one, which is what the search filters are for.
 */
function RecommendationBasisCard({ onEdit }: { onEdit: () => void }) {
	const preferences = useTripPreferences(true);
	const chips = preferences.data ? preferenceChips(preferences.data) : [];
	return (
		<section
			aria-labelledby="recommendation-basis-title"
			className="mb-5 rounded-2xl border border-[#dfe8df] bg-[#f7faf6] p-4"
		>
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3
						id="recommendation-basis-title"
						className="text-xs font-extrabold uppercase tracking-wider text-[#55685a]"
					>
						Gợi ý đang dựa trên
					</h3>
					{preferences.isLoading && (
						<p className="mt-2 text-xs text-[#667a6d]">Đang tải sở thích của bạn...</p>
					)}
					{preferences.isError && (
						<p className="mt-2 text-xs text-[#667a6d]">
							Không tải được sở thích của bạn. Gợi ý vẫn dựa trên hồ sơ và lịch sử chuyến đi.
						</p>
					)}
					{preferences.data && chips.length > 0 && (
						<ul aria-label="Sở thích của bạn" className="mt-2 flex flex-wrap gap-1.5">
							{chips.map((chip) => (
								<li
									key={chip}
									className="rounded-lg border border-[#cfe3d2] bg-white px-2 py-1 text-[11px] font-bold text-[#164027]"
								>
									{chip}
								</li>
							))}
						</ul>
					)}
					{preferences.data && chips.length === 0 && (
						<p className="mt-2 text-xs font-semibold text-[#3b5446]">
							Chưa chọn sở thích — đang gợi ý theo lịch sử chuyến đi và hồ sơ của bạn.
						</p>
					)}
				</div>
				<button
					type="button"
					onClick={onEdit}
					className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-[#cfe3d2] bg-white px-3 py-2 text-xs font-bold text-[#164027] hover:bg-[#eef5ee]"
				>
					<SlidersHorizontal className="size-4" />
					Sửa sở thích
				</button>
			</div>
			<p className="mt-3 text-[11px] leading-5 text-[#667a6d]">
				Sở thích dùng để ưu tiên chuyến phù hợp lên trước, không ẩn chuyến nào. Muốn lọc chuyến, hãy
				dùng bộ lọc ở trang tìm chuyến.
			</p>
		</section>
	);
}

interface TripRecommendationsModalProps {
	onClose: () => void;
	onSelectTrip: (tripId: string) => void;
}

export function TripRecommendationsModal({ onClose, onSelectTrip }: TripRecommendationsModalProps) {
	const [step, setStep] = useState<"results" | "preferences">("results");
	const [isSaving, setSaving] = useState(false);
	// Only runs while the results step is shown, i.e. after the Camper asked for suggestions.
	const recommendations = useTripRecommendations(step === "results");
	const data = recommendations.data;
	const onSavingChange = useCallback((saving: boolean) => setSaving(saving), []);

	if (step === "preferences") {
		return (
			<Modal
				isOpen
				onClose={onClose}
				isCloseDisabled={isSaving}
				size="xl"
				title="Sở thích để gợi ý chuyến đi"
				icon={<SlidersHorizontal className="size-5" />}
				description="Hệ thống ưu tiên các chuyến khớp lựa chọn của bạn và giải thích lý do khi bạn mở chuyến. Chuyến không khớp vẫn có thể được gợi ý nếu phù hợp ở tiêu chí khác."
			>
				<TripPreferencesForm
					onSaved={() => setStep("results")}
					onCancel={() => setStep("results")}
					onSavingChange={onSavingChange}
				/>
			</Modal>
		);
	}

	return (
		<Modal
			isOpen
			onClose={onClose}
			size="2xl"
			title="Gợi ý cho bạn"
			icon={<Sparkles className="size-5" />}
			description="Dựa trên sở thích, thể lực và những chuyến bạn đã đi."
		>
			<div className="overflow-y-auto px-5 py-5">
				{data?.status !== "needs_preferences" && (
					<RecommendationBasisCard onEdit={() => setStep("preferences")} />
				)}

				{recommendations.isLoading && (
					<div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-[#164027]">
						<Loader2 className="size-5 animate-spin" />
						<span>Đang tìm chuyến phù hợp với bạn...</span>
					</div>
				)}

				{recommendations.isError && (
					<div
						role="alert"
						className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800"
					>
						<p className="font-extrabold">Không tải được gợi ý chuyến đi.</p>
						<button
							type="button"
							onClick={() => void recommendations.refetch()}
							className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-rose-700 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-rose-800"
						>
							<RefreshCw className="size-4" />
							Thử lại
						</button>
					</div>
				)}

				{data?.status === "needs_preferences" && (
					<div className="rounded-3xl border border-dashed border-[#dfe8df] p-8 text-center">
						<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
							<SlidersHorizontal className="size-6" />
						</div>
						<h3 className="mt-3 text-sm font-extrabold text-[#10221b]">
							Cần thêm thông tin để gợi ý
						</h3>
						<p className="mx-auto mt-1 max-w-md text-xs text-[#667a6d]">
							Bạn chưa chọn sở thích và chưa có chuyến đi nào trước đây. Hãy cập nhật loại chuyến,
							độ khó, khu vực hoặc mức giá bạn muốn, rồi hệ thống sẽ gợi ý chuyến phù hợp.
						</p>
						<button
							type="button"
							onClick={() => setStep("preferences")}
							className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#164027] px-4 py-2 text-xs font-bold text-white hover:bg-[#10301d]"
						>
							<SlidersHorizontal className="size-4" />
							Cập nhật sở thích
						</button>
					</div>
				)}

				{data?.status === "ready" && data.items.length === 0 && (
					<div className="rounded-3xl border border-dashed border-[#dfe8df] p-8 text-center">
						<div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#164027]/5 text-[#164027]">
							<Compass className="size-6" />
						</div>
						<h3 className="mt-3 text-sm font-extrabold text-[#10221b]">
							Chưa có chuyến phù hợp lúc này
						</h3>
						<p className="mt-1 text-xs text-[#667a6d]">
							Các chuyến mới được mở đặt chỗ sẽ xuất hiện khi bạn xem gợi ý lần sau.
						</p>
					</div>
				)}

				{data?.status === "ready" && data.items.length > 0 && (
					<>
						<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{data.items.map((item) => {
								const reasons = recommendationReasonLabels(item.reasons);
								return (
									<li key={item.trip.id} className="flex flex-col gap-2">
										<TripCard trip={item.trip} onSelect={onSelectTrip} />
										{reasons.length > 0 && (
											<ul
												aria-label={`Lý do gợi ý chuyến ${item.trip.title}`}
												className="flex flex-wrap gap-1.5"
											>
												{reasons.map((reason) => (
													<li
														key={reason}
														className="rounded-lg bg-[#eef5ee] px-2 py-1 text-[11px] font-bold text-[#164027]"
													>
														{reason}
													</li>
												))}
											</ul>
										)}
									</li>
								);
							})}
						</ul>
						<p className="mt-4 text-[11px] text-[#7b8c82]">
							Bấm vào một chuyến để xem chi tiết vì sao chuyến đó được gợi ý. Gợi ý không giữ chỗ;
							số chỗ còn lại được kiểm tra lại khi bạn đặt chỗ.
						</p>
					</>
				)}
			</div>
		</Modal>
	);
}
