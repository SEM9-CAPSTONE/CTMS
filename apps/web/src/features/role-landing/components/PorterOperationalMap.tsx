import { useState } from "react";
import { useAssignedTripOperations, useAssignedTrips } from "../../trips/hooks/useAssignedTrips";
import { OperationalRouteMap } from "./OperationalRouteMap";
export function PorterOperationalMap() {
	const assigned = useAssignedTrips();
	const [selectedId, setSelectedId] = useState("");
	const trips = [...assigned.trips].sort((a, b) => {
		const rank = (status: string) => (status === "ongoing" ? 0 : status === "published" ? 1 : 2);
		return rank(a.status) - rank(b.status) || Date.parse(a.startsAt) - Date.parse(b.startsAt);
	});
	const selected = trips.find((trip) => trip.tripId === selectedId) ?? trips[0];
	const operations = useAssignedTripOperations(selected?.tripId ?? null);
	if (assigned.isLoading) return <p className="p-6">Đang tải phân công...</p>;
	if (assigned.error)
		return (
			<button type="button" className="p-6 underline" onClick={() => void assigned.refetch()}>
				{assigned.error} Thử lại
			</button>
		);
	if (!selected) return <p className="p-6">Bạn chưa có chuyến đi được phân công.</p>;
	return (
		<div>
			<div className="bg-sky-50 p-6">
				<h2 className="text-xl font-extrabold">{selected.title}</h2>
				<p className="mt-2 text-sm">
					Khởi hành: {new Date(selected.startsAt).toLocaleString("vi-VN")}
				</p>
				{trips.length > 1 && (
					<label className="mt-3 block text-sm font-bold">
						Chuyến được phân công
						<select
							className="mt-2 block w-full rounded-xl border bg-white p-2"
							value={selected.tripId}
							onChange={(event) => setSelectedId(event.target.value)}
						>
							{trips.map((trip) => (
								<option key={trip.tripId} value={trip.tripId}>
									{trip.title}
								</option>
							))}
						</select>
					</label>
				)}
			</div>
			{operations.isLoading && <p className="p-4">Đang tải bản đồ tuyến...</p>}
			{operations.error && (
				<button type="button" className="p-4 underline" onClick={() => void operations.refetch()}>
					{operations.error} Thử lại
				</button>
			)}
			{!operations.error && operations.data && (
				<OperationalRouteMap
					route={operations.data.route}
					meetingPoint={operations.data.meetingPoint}
				/>
			)}
		</div>
	);
}
