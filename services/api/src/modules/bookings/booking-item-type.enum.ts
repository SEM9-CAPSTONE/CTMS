/**
 * CTMS-040-T01. Only `equipment` is a referenceable add-on catalog in this
 * codebase (no separate "services" catalog module exists) -- keep this
 * enum to the one value BR-121 can actually be validated against rather
 * than inventing an unbacked "service" type.
 */
export enum BookingItemType {
	EQUIPMENT = "equipment",
}
