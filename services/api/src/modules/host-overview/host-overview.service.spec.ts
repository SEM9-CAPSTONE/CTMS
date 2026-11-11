import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { UserRole, UserStatus } from "../users/entities/user.entity";
import { HostOverviewQueryDto } from "./host-overview.dto";
import { HostOverviewRepository } from "./host-overview.repository";
import { HostOverviewService } from "./host-overview.service";
import { OverviewAvailability } from "./host-overview.types";

describe("HostOverviewService", () => {
	const repository = {
		bookings: jest.fn(),
		trips: jest.fn(),
		routes: jest.fn(),
		porters: jest.fn(),
		sos: jest.fn(),
		weather: jest.fn(),
	};
	let service: HostOverviewService;
	const actor = { userId: "host", roles: [UserRole.HOST], status: UserStatus.ACTIVE };
	beforeEach(async () => {
		jest.useFakeTimers().setSystemTime(new Date("2026-10-27T18:00:00Z"));
		for (const load of Object.values(repository))
			load.mockReset().mockResolvedValue({ total: 0, items: [] });
		const module = await Test.createTestingModule({
			providers: [
				HostOverviewService,
				{ provide: HostOverviewRepository, useValue: repository },
				{ provide: ConfigService, useValue: new ConfigService() },
			],
		}).compile();
		service = module.get(HostOverviewService);
	});
	afterEach(() => jest.useRealTimers());

	describe("getOverview", () => {
		it("uses the configured local booking day and returns legitimate zero values", async () => {
			const result = await service.getOverview(actor, new HostOverviewQueryDto());
			expect(result.bookingDate).toBe("2026-10-28");
			expect(result.kpis).toEqual({
				todaysBookings: 0,
				activeTrips: 0,
				routes: 0,
				assignedPorters: 0,
				unresolvedSos: 0,
			});
			expect(repository.bookings).toHaveBeenCalledWith(
				"host",
				"2026-10-27T18:00:00.000Z",
				"Asia/Ho_Chi_Minh",
				1,
				20
			);
		});
		it.each([UserRole.ADMIN, UserRole.CAMPER, UserRole.PORTER])(
			"denies %s before source queries",
			async (role) => {
				await expect(
					service.getOverview({ ...actor, roles: [role] }, new HostOverviewQueryDto())
				).rejects.toBeInstanceOf(ForbiddenException);
				expect(repository.bookings).not.toHaveBeenCalled();
			}
		);
		it.each([UserStatus.SUSPENDED, UserStatus.DELETED, UserStatus.PENDING_VERIFICATION])(
			"denies %s accounts",
			async (status) => {
				await expect(
					service.getOverview({ ...actor, status }, new HostOverviewQueryDto())
				).rejects.toBeInstanceOf(ForbiddenException);
				expect(repository.bookings).not.toHaveBeenCalled();
			}
		);
		it("preserves unavailable source instead of converting failure into zero", async () => {
			repository.sos.mockRejectedValue(new Error("sensitive SQL details"));
			const result = await service.getOverview(actor, new HostOverviewQueryDto());
			expect(result.kpis.unresolvedSos).toBeNull();
			expect(result.sos.availability).toBe(OverviewAvailability.UNAVAILABLE);
			expect(result.sos.data).toBeNull();
			expect(result.bookings.availability).toBe(OverviewAvailability.AVAILABLE);
			expect(JSON.stringify(result)).not.toContain("sensitive SQL details");
		});
		it("takes KPIs from full source totals, not page lengths", async () => {
			repository.porters.mockResolvedValue({ total: 30, items: [] });
			const result = await service.getOverview(actor, { page: 3, limit: 5 });
			expect(result.kpis.assignedPorters).toBe(30);
			expect(repository.porters).toHaveBeenCalledWith("host", 3, 5);
		});
	});
	it("rejects invalid freshness and timezone deployment configuration", () => {
		expect(
			() =>
				new HostOverviewService(
					repository as unknown as HostOverviewRepository,
					new ConfigService({ HOST_OVERVIEW_WEATHER_MAX_AGE_SECONDS: "0" })
				)
		).toThrow();
		expect(
			() =>
				new HostOverviewService(
					repository as unknown as HostOverviewRepository,
					new ConfigService({ HOST_OVERVIEW_TIME_ZONE: "invalid" })
				)
		).toThrow();
	});
});
