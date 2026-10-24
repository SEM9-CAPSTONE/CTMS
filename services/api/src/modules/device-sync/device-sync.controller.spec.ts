import { UserRole } from "../users/entities/user.entity";
import { DeviceSyncController } from "./device-sync.controller";
import type { DeviceSyncService } from "./device-sync.service";
import type { DeviceSyncStatusResponseDto } from "./dto/device-sync-status-response.dto";

describe("DeviceSyncController (CTMS-067)", () => {
	let controller: DeviceSyncController;
	let service: jest.Mocked<DeviceSyncService>;

	beforeEach(() => {
		service = {
			getSyncStatus: jest.fn(),
		} as unknown as jest.Mocked<DeviceSyncService>;

		controller = new DeviceSyncController(service);
	});

	it("delegates to DeviceSyncService with user context and tripId", async () => {
		const expected: DeviceSyncStatusResponseDto = {
			tripId: "trip-uuid",
			userId: "user-uuid",
			participantRole: "porter",
			serverConfirmedGpsCount: 15,
			serverConfirmedSafetyCount: 0,
			lastReceivedAt: "2026-10-23T10:00:00.000Z",
			packageVersion: "v1",
			configVersion: "v3",
		};
		service.getSyncStatus.mockResolvedValue(expected);

		const request = {
			user: {
				userId: "user-uuid",
				email: "porter@example.com",
				roles: [UserRole.PORTER],
			},
		};

		const result = await controller.getStatus(request, "trip-uuid");

		expect(service.getSyncStatus).toHaveBeenCalledWith("user-uuid", [UserRole.PORTER], "trip-uuid");
		expect(result).toBe(expected);
	});
});
