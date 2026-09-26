import { Module } from "@nestjs/common";
import { DataSource } from "typeorm";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Booking } from "../profiles/entities/booking.entity";
import { TripsModule } from "../trips/trips.module";
import { WeatherModule } from "../weather/weather.module";
import { BookingsController } from "./bookings.controller";
import { BookingsRepository } from "./bookings.repository";
import { BookingsService } from "./bookings.service";

@Module({
	imports: [TripsModule, WeatherModule],
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
	],
})
export class BookingsModule {}
