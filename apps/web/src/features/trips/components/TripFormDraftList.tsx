import { useQuery } from "@tanstack/react-query";
import { Calendar, Pencil, Users } from "lucide-react";
import { useEffect } from "react";
import { queryKeys } from "../../../core/api";
import { listRecoverableTripDrafts } from "../services/trip-draft-recovery.service";
import { TripDraftCover } from "./TripDraftCover";
interface Props {
	visible: boolean;
	onOpen?: (id: string) => void;
	onCountChange: (count: number) => void;
	onLinkedTrips?: (ids: string[]) => void;
}
export function TripFormDraftList({ visible, onOpen, onCountChange, onLinkedTrips }: Props) {
	const query = useQuery({
		queryKey: queryKeys.trips.formDrafts,
		queryFn: listRecoverableTripDrafts,
		staleTime: 0,
	});
	useEffect(() => {
		onCountChange(query.data?.length ?? 0);
		onLinkedTrips?.((query.data ?? []).flatMap((draft) => (draft.tripId ? [draft.tripId] : [])));
	}, [query.data, onCountChange, onLinkedTrips]);
	if (!visible) return null;
	if (query.isError)
		return (
			<div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
				Không thể tải bản nháp.{" "}
				<button type="button" onClick={() => void query.refetch()}>
					Thử lại
				</button>
			</div>
		);
	if (!query.data?.length) return null;
	return (
		<div
			className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
			aria-label="Bản nháp đang soạn"
		>
			{query.data.map((draft) => {
				const title = draft.title?.trim() || "-";
				const price = draft.pricePerPerson?.trim();
				const priceLabel =
					price && /^\d+$/.test(price) ? `${Number(price).toLocaleString("vi-VN")} đ` : "-";
				const start = draft.startsAt ? new Date(draft.startsAt) : null;
				const end = draft.endsAt ? new Date(draft.endsAt) : null;
				const dateLabel =
					start && Number.isFinite(start.getTime())
						? `${start.toLocaleDateString("vi-VN")}${end && Number.isFinite(end.getTime()) && end.toDateString() !== start.toDateString() ? ` – ${end.toLocaleDateString("vi-VN")}` : ""}`
						: "-";
				return (
					<article
						key={draft.id}
						className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#e5eee7] bg-[#fbfdfb] text-left transition-all hover:-translate-y-1 hover:border-[#b8cfbc] hover:shadow-md"
					>
						<div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[#e8efe9]">
							<TripDraftCover draft={draft} />
							<span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200">
								<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
								Bản nháp
							</span>
						</div>
						<div className="flex flex-1 flex-col p-4">
							<h3
								title={title}
								className="truncate h-5 text-sm leading-5 font-extrabold text-[#10221b] group-hover:text-[#164027]"
							>
								{title}
							</h3>
							<div className="mt-3 mb-4 space-y-1.5 text-xs text-[#55685a]">
								<p className="flex items-center gap-2">
									<Calendar className="size-3.5 shrink-0 text-[#8fa096]" />
									<span className="truncate">{dateLabel}</span>
								</p>
								<p className="flex items-center gap-2">
									<Users className="size-3.5 shrink-0 text-[#8fa096]" />
									<span>{draft.capacityMax ? `0 / ${draft.capacityMax} chỗ` : "-"}</span>
								</p>
							</div>
							<div className="mt-auto">
								<div className="flex min-h-[53px] items-center justify-between gap-2 border-t border-[#edf3ee] pt-3">
									<div className="min-w-0">
										<p className="text-[10px] font-bold uppercase tracking-wider text-[#8fa096]">
											Giá vé
										</p>
										<p className="text-sm font-extrabold text-[#164027]">{priceLabel}</p>
									</div>
									<button
										type="button"
										aria-label="Tiếp tục chỉnh sửa"
										title={draft.syncPending ? "Đã lưu trên thiết bị · Chờ đồng bộ" : undefined}
										onClick={() => onOpen?.(draft.id)}
										className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-[#164027] ring-1 ring-[#cbd9ce] transition-colors hover:bg-[#f4f7f2]"
									>
										<Pencil className="size-3.5 shrink-0" />
										<span>Sửa</span>
									</button>
								</div>
							</div>
						</div>
					</article>
				);
			})}
		</div>
	);
}
