import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { EquipmentReservation } from "./entities/equipment-reservation.entity";

@Injectable()
export class EquipmentReservationsRepository extends Repository<EquipmentReservation> {
	findByBookingForUpdate(bookingId: string): Promise<EquipmentReservation[]> {
		return this.createQueryBuilder("reservation")
			.innerJoin("reservation.bookingItem", "item")
			.where("item.bookingId = :bookingId", { bookingId })
			.orderBy("reservation.id", "ASC")
			.setLock("pessimistic_write", undefined, ["reservation"])
			.getMany();
	}

	/**
	 * BR-127/129. Two date ranges overlap when each starts on or before the
	 * other's end -- the standard inclusive interval-overlap test.
	 */
	sumOverlappingQuantity(
		equipmentCatalogItemId: string,
		rentalStartDate: string,
		rentalEndDate: string
	): Promise<number> {
		return this.createQueryBuilder("reservation")
			.select("COALESCE(SUM(reservation.quantity), 0)", "sum")
			.where("reservation.equipmentCatalogItemId = :equipmentCatalogItemId", {
				equipmentCatalogItemId,
			})
			.andWhere("reservation.rentalStartDate <= :rentalEndDate", { rentalEndDate })
			.andWhere("reservation.rentalEndDate >= :rentalStartDate", { rentalStartDate })
			.andWhere("reservation.status = 'active'")
			.getRawOne<{ sum: string }>()
			.then((row) => Number(row?.sum ?? 0));
	}
}
