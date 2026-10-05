import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BookingMemberStatus } from "../booking-member-status.enum";
import { UpdateBookingMemberStatusDto } from "./update-booking-member-status.dto";

describe("UpdateBookingMemberStatusDto", () => {
	it.each([BookingMemberStatus.JOINED, BookingMemberStatus.NO_SHOW])(
		"accepts %s",
		async (status) => {
			expect(
				await validate(plainToInstance(UpdateBookingMemberStatusDto, { status }))
			).toHaveLength(0);
		}
	);

	it.each([
		BookingMemberStatus.REGISTERED,
		BookingMemberStatus.REMOVED,
		BookingMemberStatus.LEFT,
		"arbitrary",
	])("rejects unsupported status %s", async (status) => {
		expect(
			await validate(plainToInstance(UpdateBookingMemberStatusDto, { status }))
		).not.toHaveLength(0);
	});
});
