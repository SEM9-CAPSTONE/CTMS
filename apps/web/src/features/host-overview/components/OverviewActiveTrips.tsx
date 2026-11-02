import { ArrowUpRight, Mountain } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../../../shared/components/Button";
import { OVERVIEW_TEXT as text } from "../constants";
import { useHostOverview } from "../hooks/useHostOverview";
import { overviewDate, overviewStatus } from "../utils";
import { OverviewListPagination } from "./OverviewListPagination";
import { OverviewSection } from "./OverviewSection";

const ACTIVE_TRIPS_PAGE_SIZE = 3;

export function OverviewActiveTrips({
	hostId,
	onTrip,
	onRestricted,
}: {
	hostId: string;
	onTrip: (id: string) => void;
	onRestricted: () => void;
}) {
	const [page, setPage] = useState(1);
	const query = useHostOverview(hostId, page, true, ACTIVE_TRIPS_PAGE_SIZE);
	useEffect(() => {
		if (query.restricted) onRestricted();
	}, [query.restricted, onRestricted]);
	const data = query.data;
	const total = data?.activeTrips.data?.total ?? null;
	useEffect(() => {
		if (total !== null && page > Math.max(1, Math.ceil(total / ACTIVE_TRIPS_PAGE_SIZE))) {
			setPage(Math.max(1, Math.ceil(total / ACTIVE_TRIPS_PAGE_SIZE)));
		}
	}, [total, page]);
	if (query.restricted) return null;
	if (!data)
		return (
			<section aria-label={text.trips} className="rounded-2xl border border-[#e0e7df] bg-white p-5">
				<h2 className="text-base font-bold text-[#10221b]">{text.trips}</h2>
				{query.isPending ? (
					<output className="mt-4 block">{text.loading}</output>
				) : (
					<div role="alert" className="mt-4">
						<p>{text.error}</p>
						<Button
							size="sm"
							onClick={() => {
								void query.refetch();
							}}
						>
							{text.retry}
						</Button>
					</div>
				)}
			</section>
		);
	const zone = data.timeZone;
	return (
		<div className="flex min-w-0 flex-col rounded-2xl border border-[#e0e7df] bg-white">
			<OverviewSection
				title={text.trips}
				section={data.activeTrips}
				timeZone={zone}
				surface="plain"
				className="flex-1 p-5"
			>
				{(item) => (
					<div className="flex items-start gap-3">
						<div className="relative mt-1 flex h-20 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#edf5ed] text-[#32704c] sm:h-24 sm:w-32">
							<Mountain aria-hidden="true" className="size-6" />
							{item.coverImageUrl && (
								<img
									key={item.coverImageUrl}
									src={item.coverImageUrl}
									alt={`Ảnh chuyến đi ${item.title}`}
									loading="lazy"
									className="absolute inset-0 size-full object-cover"
									onError={(event) => {
										event.currentTarget.hidden = true;
									}}
								/>
							)}
						</div>
						<div className="min-w-0 flex-1">
							<span className="inline-flex rounded-full bg-[#edf5ed] px-2 py-1 text-[10px] font-semibold text-[#32704c]">
								{overviewStatus(item.status)}
							</span>
							<p className="mt-2 text-base font-semibold leading-6 text-[#183a28]">{item.title}</p>
							<p className="mt-2 text-xs leading-5 text-[#718076]">
								{overviewDate(item.startsAt, zone)} – {overviewDate(item.endsAt, zone)}
							</p>
							<Button
								size="sm"
								variant="outline"
								className="mt-3 gap-2"
								onClick={() => onTrip(item.id)}
							>
								{text.tripDetail}
								<ArrowUpRight aria-hidden="true" className="size-3.5" />
							</Button>
						</div>
					</div>
				)}
			</OverviewSection>
			<div className="px-5 pb-4">
				<OverviewListPagination
					label={text.trips}
					total={total}
					page={page}
					limit={ACTIVE_TRIPS_PAGE_SIZE}
					busy={query.isFetching}
					onPage={setPage}
				/>
			</div>
		</div>
	);
}
