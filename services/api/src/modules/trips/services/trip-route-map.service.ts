import { Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS dependency injection needs runtime metadata
import { DataSource } from "typeorm";
import type { TripRouteMapResponseDto } from "../dto/trip-route-map-response.dto";
import { TRIP_ROUTE_PROJECTION_SQL } from "../repositories/trip-route-projection";
@Injectable()
export class TripRouteMapService {
	constructor(private readonly dataSource: DataSource) {}
	async getBookedTripMap(userId: string, tripId: string): Promise<TripRouteMapResponseDto> {
		const rows: TripRouteMapResponseDto[] = await this.dataSource.query(
			`
   SELECT trip.id AS "tripId", trip.title, ST_AsGeoJSON(trip.meeting_point)::jsonb AS "meetingPoint",
    ${TRIP_ROUTE_PROJECTION_SQL} AS route
   FROM trips trip LEFT JOIN trekking_routes route ON route.id = trip.route_id
   WHERE trip.id = $2 AND trip.status IN ('published','ongoing','completed')
    AND EXISTS (SELECT 1 FROM bookings booking WHERE booking.trip_id = trip.id
     AND booking.user_id = $1 AND booking.status IN ('confirmed','pending_reconfirmation','completed'))
  `,
			[userId, tripId]
		);
		if (!rows[0]) throw new NotFoundException("Booked Trip map not found");
		return rows[0];
	}
}
