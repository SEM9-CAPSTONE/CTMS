import type { TripDetails } from "../../trips/types";
export function CamperTripSummary({ trip }: { trip: TripDetails }) {
	return (
		<div className="min-w-0 bg-emerald-50 px-14 py-6">
			<p className="text-xs font-bold uppercase text-emerald-800">
				{trip.status === "ongoing" || Date.parse(trip.startsAt) <= Date.now()
					? "Chuyến đang diễn ra"
					: "Chuyến sắp khởi hành"}
			</p>
			<h2 className="mt-3 text-2xl font-extrabold">{trip.title}</h2>
			<p className="mt-3 text-sm">Khởi hành: {new Date(trip.startsAt).toLocaleString("vi-VN")}</p>
			{trip.host?.fullName && <p className="mt-3 text-sm">Host: {trip.host.fullName}</p>}
			<a
				href={`/trips/${trip.id}`}
				className="mt-5 inline-block rounded-xl bg-[#164027] px-4 py-2 text-sm font-bold text-white"
			>
				Xem chuyến đi
			</a>
		</div>
	);
}
