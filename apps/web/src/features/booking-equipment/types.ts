import type { EquipmentCatalogItem } from "../equipment-catalog/types";

export type TripEquipmentOption = EquipmentCatalogItem;

export interface AddBookingItemInput {
	equipmentCatalogItemId: string;
	quantity: number;
}

export interface BookingItem {
	id: string;
	bookingId: string;
	itemType: "equipment";
	equipmentCatalogItemId: string;
	quantity: number;
	unitPrice: string;
	rentalDays: number;
	totalPrice: string;
	createdAt: string;
}

export interface AddBookingItemResult {
	item: BookingItem;
	booking: { id: string; totalAmount: string };
}
