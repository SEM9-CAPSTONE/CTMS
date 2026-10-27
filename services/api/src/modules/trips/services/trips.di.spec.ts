import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { EventsGateway } from "../../realtime/events.gateway";
import { CheckpointVisitsRepository } from "../repositories/checkpoint-visits.repository";
import { TripsRepository } from "../repositories/trips.repository";
import { TripImagesService } from "./trip-images.service";
import { TripsService } from "./trips.service";

describe("TripsService dependency injection", () => {
	it("retains runtime class tokens and resolves all constructor dependencies", async () => {
		expect(Reflect.getMetadata("design:paramtypes", TripsService)).toEqual([
			TripsRepository,
			DataSource,
			EventsGateway,
			CheckpointVisitsRepository,
			TripImagesService,
		]);
		const module = await Test.createTestingModule({
			providers: [
				TripsService,
				{ provide: TripsRepository, useValue: {} },
				{ provide: DataSource, useValue: {} },
				{ provide: EventsGateway, useValue: {} },
				{ provide: CheckpointVisitsRepository, useValue: {} },
				{ provide: TripImagesService, useValue: {} },
			],
		}).compile();
		expect(module.get(TripsService)).toBeInstanceOf(TripsService);
		await module.close();
	});
});
