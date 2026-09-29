import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { EquipmentCatalogModule } from "../equipment-catalog/equipment-catalog.module";
import { Booking } from "../profiles/entities/booking.entity";
import { ProfilesModule } from "../profiles/profiles.module";
import { TripsModule } from "../trips/trips.module";
import { WeatherModule } from "../weather/weather.module";
import { BookingItemsRepository } from "./booking-items.repository";
import { BookingMembersRepository } from "./booking-members.repository";
import { BookingsController } from "./bookings.controller";
import { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";
import { BookingItem } from "./entities/booking-item.entity";
import { BookingMember } from "./entities/booking-member.entity";
import { EquipmentReservation } from "./entities/equipment-reservation.entity";
import { EquipmentReservationsRepository } from "./equipment-reservations.repository";

@Module({
	imports: [TripsModule, WeatherModule, EquipmentCatalogModule, ProfilesModule],
	controllers: [BookingsController],
	providers: [
		BookingsService,
		JwtAuthGuard,
		RolesGuard,
		{
			provide: BookingsRepository,
			useFactory: (dataSource: DataSource) =>
				new BookingsRepository(Booking, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: BookingItemsRepository,
			useFactory: (dataSource: DataSource) =>
				new BookingItemsRepository(BookingItem, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: BookingMembersRepository,
			useFactory: (dataSource: DataSource) =>
				new BookingMembersRepository(BookingMember, dataSource.createEntityManager()),
			inject: [DataSource],
		},
		{
			provide: EquipmentReservationsRepository,
			useFactory: (dataSource: DataSource) =>
				new EquipmentReservationsRepository(EquipmentReservation, dataSource.createEntityManager()),
			inject: [DataSource],
		},
	],
})
export class BookingsModule {}
