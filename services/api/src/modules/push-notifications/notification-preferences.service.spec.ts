import type { DataSource } from "typeorm";
import { NotificationPreferencesService } from "./notification-preferences.service";
import { PushCategory } from "./push-notifications.types";

function setup() {
	const query = jest.fn();
	const db = { manager: { query }, query, transaction: jest.fn(async (work) => work({ query })) };
	return { query, db, service: new NotificationPreferencesService(db as unknown as DataSource) };
}

it("returns explicit defaults and keeps safety categories locked for every role", async () => {
	const { query, service } = setup();
	query.mockResolvedValue([{ version: 0, preferences: {} }]);
	const result = await service.get("owner");
	expect(result.version).toBe(0);
	expect(result.channel).toBe("push");
	expect(result.categories).toHaveLength(5);
	expect(result.categories.every((item) => item.enabled && item.effectiveEnabled)).toBe(true);
	expect(result.categories.find((item) => item.category === "sos")).toMatchObject({
		configurable: false,
	});
	expect(result.categories.find((item) => item.category === "weather")).toMatchObject({
		mandatoryOverride: "red_weather",
	});
	expect(query.mock.calls[0][1]).toEqual(["owner"]);
});

it.each([
	["sos", "MANDATORY_NOTIFICATION_TYPE"],
	["emergency", "MANDATORY_NOTIFICATION_TYPE"],
	["unknown", "UNSUPPORTED_NOTIFICATION_TYPE"],
])("rejects the complete patch before writing when it includes %s", async (category, code) => {
	const { db, service } = setup();
	await expect(
		service.patch("owner", 0, [
			{ category: "booking", enabled: false },
			{ category, enabled: false },
		])
	).rejects.toMatchObject({ response: { code } });
	expect(db.transaction).not.toHaveBeenCalled();
});

it("rejects stale versions and duplicate category changes", async () => {
	const { query, service } = setup();
	query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ version: 2 }]);
	await expect(
		service.patch("owner", 1, [{ category: "booking", enabled: false }])
	).rejects.toMatchObject({ status: 409 });
	await expect(
		service.patch("owner", 2, [
			{ category: "booking", enabled: false },
			{ category: "booking", enabled: true },
		])
	).rejects.toMatchObject({ status: 422 });
	expect(query).toHaveBeenCalledTimes(2);
});

it("loads one fresh preference snapshot per batch and defaults to enabled on lookup failure", async () => {
	const { query, service } = setup();
	query.mockResolvedValueOnce([{ user_id: "a", category: "weather", enabled: false }]);
	const snapshot = await service.loadBatch(["a", "a", "b"]);
	expect(await snapshot.allows("a", PushCategory.WEATHER)).toBe(false);
	expect(await snapshot.allows("b", PushCategory.WEATHER)).toBe(true);
	expect(query.mock.calls[0][1]).toEqual([["a", "b"]]);
	query.mockRejectedValueOnce(new Error("lookup failed"));
	expect(await service.allows("a", PushCategory.WEATHER)).toBe(true);
});
