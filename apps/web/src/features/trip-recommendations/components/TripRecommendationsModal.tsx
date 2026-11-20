import { Compass, Loader2, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { Modal } from "../../../shared/components/Modal";
import { TripCard } from "../../trips/components/TripCard";
import {
	useRegenerateTripRecommendations,
	useTripRecommendations,
} from "../hooks/useTripRecommendations";
import { HealthConsentRequired } from "./HealthConsentRequired";
import { TripPreferencesForm } from "./TripPreferencesForm";

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

interface TripRecommendationsModalProps {
	onClose: () => void;
	onSelectTrip: (tripId: string) => void;
}

export function TripRecommendationsModal({ onClose, onSelectTrip }: TripRecommendationsModalProps) {
	const [step, setStep] = useState<"results" | "preferences">("results");
	const [isSaving, setSaving] = useState(false);
	// Only runs while the results step is shown, i.e. after the Camper asked for suggestions.
	const recommendations = useTripRecommendations(step === "results");
	const regenerate = useRegenerateTripRecommendations();
	const isGenerating = recommendations.isFetching || regenerate.isPending;
	const data =
		!isGenerating && !recommendations.isError && !regenerate.isError
			? recommendations.data
			: undefined;
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
		>
			<div className="overflow-y-auto px-5 py-5">
				{(data?.status === "ready" || regenerate.isPending) && (
					<div className="mb-4 flex flex-wrap items-center gap-3">
						<Button variant="outline" disabled={isGenerating} onClick={() => regenerate.mutate()}>
							{isGenerating ? "Đang tạo gợi ý..." : "Tạo lại gợi ý chuyến đi"}
						</Button>
						<Button
							variant="outline"
							disabled={isGenerating}
							onClick={() => setStep("preferences")}
						>
							<SlidersHorizontal className="size-4" />
							Sửa sở thích
						</Button>
					</div>
				)}
				{data?.status === "needs_health_consent" && (
					<HealthConsentRequired
						onRetry={() => {
							regenerate.reset();
							void recommendations.refetch();
						}}
					/>
				)}

				{isGenerating && (
					<div className="flex items-center justify-center gap-2 p-10 text-sm font-bold text-[#164027]">
						<Loader2 className="size-5 animate-spin" />
						<span>Đang tìm chuyến phù hợp với bạn...</span>
					</div>
				)}

				{(recommendations.isError || regenerate.isError) && (
					<div
						role="alert"
						className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-800"
					>
						<p className="font-extrabold">Không tải được gợi ý chuyến đi.</p>
						<button
							type="button"
							onClick={() => {
								regenerate.reset();
								void recommendations.refetch();
							}}
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
					<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.items.map((item) => (
							<li key={item.trip.id}>
								<TripCard trip={item.trip} onSelect={onSelectTrip} />
							</li>
						))}
					</ul>
				)}
			</div>
		</Modal>
	);
}
