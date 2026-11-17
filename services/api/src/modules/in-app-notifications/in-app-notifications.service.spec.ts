import { NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { DataSource } from "typeorm";
import {
	InAppNotificationsService,
	decodeNotificationCursor,
} from "./in-app-notifications.service";

describe("InAppNotificationsService", () => {
	const query = jest.fn();
	const service = new InAppNotificationsService({ query } as unknown as DataSource);
	beforeEach(() => jest.clearAllMocks());
	it.each([
		"invalid",
		Buffer.from("{}").toString("base64url"),
		Buffer.from('{"createdAt":"bad","id":"bad"}').toString("base64url"),
	])("rejects malformed cursor %s before querying", async (cursor) => {
		await expect(service.list("recipient", { cursor, limit: 20 })).rejects.toBeInstanceOf(
			UnprocessableEntityException
		);
		expect(query).not.toHaveBeenCalled();
	});
	it("preserves PostgreSQL microseconds in the cursor", () => {
		const cursor = {
			createdAt: "2026-11-17T00:00:00.123456Z",
			id: "b5d672f5-524b-4f3f-a124-7229d406c897",
		};
		expect(
			decodeNotificationCursor(Buffer.from(JSON.stringify(cursor)).toString("base64url"))
		).toEqual(cursor);
	});
	it("returns a generic not found for an unowned notification", async () => {
		query.mockResolvedValueOnce([]);
		await expect(service.markRead("recipient", "notification")).rejects.toBeInstanceOf(
			NotFoundException
		);
	});
	it("redacts inaccessible target information", async () => {
		query.mockResolvedValueOnce([
			{
				id: "notification",
				event_type: "trip.review.requested",
				occurred_at: new Date(),
				created_at: new Date(),
				read_at: null,
				trip_id: "private-trip",
				title: "Private title",
				accessible: false,
			},
		]);
		const result = await service.list("recipient", { limit: 20 });
		expect(result.items[0]).toMatchObject({ target: null, targetAvailable: false });
		expect(JSON.stringify(result)).not.toContain("Private title");
		expect(JSON.stringify(result)).not.toContain("private-trip");
	});
});
