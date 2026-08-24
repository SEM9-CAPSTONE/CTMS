import { mkdir, rename, unlink } from "node:fs/promises";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
import type { CampsiteMedia } from "../entities/campsite-media.entity";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import { type Zone, ZoneStatus } from "../entities/zone.entity";
import type {
	CampsiteSearchResult,
	CampsitesRepository,
	CreatedPendingApprovalCampsite,
} from "../repositories/campsites.repository";
import { CampsitesService } from "./campsites.service";

jest.mock("node:fs/promises", () => ({
	mkdir: jest.fn(),
	rename: jest.fn(),
	unlink: jest.fn(),
}));

const mkdirMock = jest.mocked(mkdir);
const renameMock = jest.mocked(rename);
const unlinkMock = jest.mocked(unlink);

function buildCampsite(overrides: Partial<Campsite> = {}): Campsite {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		hostId: "22222222-2222-2222-2222-222222222222",
		host: undefined as unknown as Campsite["host"],
		name: "Fixture Campsite",
		description: "desc",
		location: { type: "Point", coordinates: [108.458313, 11.940419] },
		province: "Lam Dong",
		policies: { rules: "n/a" },
		operatingHours: { opensAt: "08:00", closesAt: "18:00" },
		seasonStartDate: null,
		seasonEndDate: null,
		maxAdvanceBookingDays: null,
		minNights: null,
		maxNights: null,
		status: CampsiteStatus.ACTIVE,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

function buildMedia(overrides: Partial<CampsiteMedia> = {}): CampsiteMedia {
	return {
		id: "33333333-3333-3333-3333-333333333333",
		campsiteId: "11111111-1111-1111-1111-111111111111",
		campsite: undefined as unknown as CampsiteMedia["campsite"],
		url: "https://example.com/campsite.jpg",
		type: "photo",
		sortOrder: 0,
		...overrides,
	};
}

function buildZone(overrides: Partial<Zone> = {}): Zone {
	return {
		id: "44444444-4444-4444-4444-444444444444",
		campsiteId: "11111111-1111-1111-1111-111111111111",
		campsite: undefined as unknown as Zone["campsite"],
		name: "Bai ven suoi",
		location: { type: "Point", coordinates: [108.46, 11.95] },
		maxTents: 8,
		maxPeople: 24,
		basePrice: "250000.00",
		amenities: ["water", "shade"],
		terrainNote: "Flat ground near stream",
		status: ZoneStatus.ACTIVE,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

function buildQuery(overrides: Partial<SearchCampsitesQueryDto> = {}): SearchCampsitesQueryDto {
	return {
		page: 1,
		limit: 20,
		...overrides,
	};
}

describe("CampsitesService", () => {
	let service: CampsitesService;
	let campsitesRepository: {
		searchActive: jest.Mock;
		createPendingApproval: jest.Mock;
		findByHost: jest.Mock;
		findOne: jest.Mock;
		findDetailedById: jest.Mock;
		updateInformation: jest.Mock;
	};
	let transactionalCampsitesRepository: {
		createPendingApproval: jest.Mock;
		findDetailedById: jest.Mock;
		updateInformation: jest.Mock;
	};
	let auditRepository: { save: jest.Mock };
	let mediaRepository: {
		find: jest.Mock;
		remove: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
	};
	let dataSource: { transaction: jest.Mock };

	beforeEach(() => {
		jest.clearAllMocks();
		mkdirMock.mockResolvedValue(undefined);
		renameMock.mockResolvedValue(undefined);
		unlinkMock.mockResolvedValue(undefined);
		transactionalCampsitesRepository = {
			createPendingApproval: jest.fn(),
			findDetailedById: jest.fn(),
			updateInformation: jest.fn(),
		};
		auditRepository = {
			save: jest.fn(),
		};
		mediaRepository = {
			find: jest.fn().mockResolvedValue([]),
			remove: jest.fn().mockResolvedValue([]),
			create: jest.fn((data) => ({ id: "media-uuid", ...data })),
			save: jest.fn((data) => Promise.resolve(data)),
		};
		campsitesRepository = {
			searchActive: jest
				.fn()
				.mockResolvedValue({ items: [], total: 0 } satisfies CampsiteSearchResult),
			createPendingApproval: jest.fn(),
			findByHost: jest.fn().mockResolvedValue([]),
			findOne: jest.fn(),
			findDetailedById: jest.fn(),
			updateInformation: jest.fn(),
		};
		dataSource = {
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					withRepository: jest.fn().mockReturnValue(transactionalCampsitesRepository),
					getRepository: jest.fn().mockImplementation((entity) => {
						if (entity === AuditLog) return auditRepository;
						if (entity.name === "CampsiteMedia") return mediaRepository;
						return {};
					}),
				})
			),
		};
		service = new CampsitesService(
			campsitesRepository as unknown as CampsitesRepository,
			dataSource as never
		);
	});

	describe("create", () => {
		const hostId = "22222222-2222-2222-2222-222222222222";
		const createDto = {
			name: "Da Lat Pine Camp",
			description: "Quiet campsite in the pine forest",
			latitude: 11.940419,
			longitude: 108.458313,
			province: "Lam Dong",
			policies: { rules: "No campfires after 21:00" },
			operatingHours: { opensAt: "08:00", closesAt: "18:00" },
			media: [
				{ url: "https://example.com/cover.jpg", type: "photo" as const },
				{ url: "https://example.com/map.jpg", type: "photo" as const, sortOrder: 5 },
			],
			zones: [
				{
					name: "Bai ven suoi",
					latitude: 11.95,
					longitude: 108.46,
					maxTents: 8,
					maxPeople: 24,
					basePrice: 250000,
					amenities: ["water"],
					terrainNote: "Flat ground",
				},
			],
		};

		it("creates a pending approval campsite with media and zones for the requesting Host", async () => {
			const campsite = buildCampsite({
				hostId,
				name: createDto.name,
				status: CampsiteStatus.PENDING_APPROVAL,
			});
			const media = [buildMedia(), buildMedia({ id: "55555555-5555-5555-5555-555555555555" })];
			const zones = [buildZone()];
			transactionalCampsitesRepository.createPendingApproval.mockResolvedValue({
				campsite,
				media,
				zones,
				latitude: createDto.latitude,
				longitude: createDto.longitude,
			} satisfies CreatedPendingApprovalCampsite);

			const result = await service.create(hostId, createDto);

			expect(transactionalCampsitesRepository.createPendingApproval).toHaveBeenCalledWith({
				hostId,
				name: "Da Lat Pine Camp",
				description: "Quiet campsite in the pine forest",
				latitude: 11.940419,
				longitude: 108.458313,
				province: "Lam Dong",
				policies: { rules: "No campfires after 21:00" },
				operatingHours: { opensAt: "08:00", closesAt: "18:00" },
				seasonStartDate: undefined,
				seasonEndDate: undefined,
				maxAdvanceBookingDays: undefined,
				minNights: undefined,
				maxNights: undefined,
				media: [
					{ url: "https://example.com/cover.jpg", type: "photo", sortOrder: undefined },
					{ url: "https://example.com/map.jpg", type: "photo", sortOrder: 5 },
				],
				zones: createDto.zones,
			});
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: hostId,
					action: "campsite.created",
					targetType: "campsite",
					targetId: campsite.id,
					after: expect.objectContaining({
						status: CampsiteStatus.PENDING_APPROVAL,
						media: expect.arrayContaining([
							expect.objectContaining({ url: "https://example.com/campsite.jpg" }),
						]),
						zones: expect.arrayContaining([expect.objectContaining({ maxTents: 8 })]),
					}),
				})
			);
			expect(result).toEqual(
				expect.objectContaining({
					id: campsite.id,
					hostId,
					status: CampsiteStatus.PENDING_APPROVAL,
					latitude: 11.940419,
					longitude: 108.458313,
					media: expect.arrayContaining([
						expect.objectContaining({ url: "https://example.com/campsite.jpg" }),
					]),
					zones: expect.arrayContaining([expect.objectContaining({ name: "Bai ven suoi" })]),
				})
			);
		});

		it("defaults omitted media type to photo before persistence", async () => {
			transactionalCampsitesRepository.createPendingApproval.mockResolvedValue({
				campsite: buildCampsite({ status: CampsiteStatus.PENDING_APPROVAL }),
				media: [buildMedia()],
				zones: [],
				latitude: createDto.latitude,
				longitude: createDto.longitude,
			} satisfies CreatedPendingApprovalCampsite);

			await service.create(hostId, {
				...createDto,
				media: [{ url: "https://example.com/cover.jpg" }],
			});

			expect(transactionalCampsitesRepository.createPendingApproval).toHaveBeenCalledWith(
				expect.objectContaining({
					media: [{ url: "https://example.com/cover.jpg", type: "photo", sortOrder: undefined }],
				})
			);
		});

		it("promotes pending uploaded media before saving the campsite", async () => {
			transactionalCampsitesRepository.createPendingApproval.mockResolvedValue({
				campsite: buildCampsite({ status: CampsiteStatus.PENDING_APPROVAL }),
				media: [
					buildMedia({
						url: "http://localhost:3000/uploads/campsites/campsite-temp.jpg",
					}),
				],
				zones: [],
				latitude: createDto.latitude,
				longitude: createDto.longitude,
			} satisfies CreatedPendingApprovalCampsite);

			await service.create(hostId, {
				...createDto,
				media: [
					{
						url: "http://localhost:3000/uploads/campsites/pending/campsite-temp.jpg",
						type: "photo",
						sortOrder: 0,
					},
				],
			});

			expect(renameMock).toHaveBeenCalledWith(
				expect.stringContaining("uploads\\campsites\\pending\\campsite-temp.jpg"),
				expect.stringContaining("uploads\\campsites\\campsite-temp.jpg")
			);
			expect(transactionalCampsitesRepository.createPendingApproval).toHaveBeenCalledWith(
				expect.objectContaining({
					media: [
						{
							url: "http://localhost:3000/uploads/campsites/campsite-temp.jpg",
							type: "photo",
							sortOrder: 0,
						},
					],
				})
			);
		});

		it("returns a validation error when a pending uploaded image no longer exists", async () => {
			const missingFileError = new Error("missing pending file") as NodeJS.ErrnoException;
			missingFileError.code = "ENOENT";
			renameMock.mockRejectedValueOnce(missingFileError);

			await expect(
				service.create(hostId, {
					...createDto,
					media: [
						{
							url: "http://localhost:3000/uploads/campsites/pending/missing.jpg",
							type: "photo",
						},
					],
				})
			).rejects.toMatchObject({
				status: 422,
			});

			expect(transactionalCampsitesRepository.createPendingApproval).not.toHaveBeenCalled();
		});

		it("propagates create failures so the transaction can roll back without an audit log", async () => {
			const error = new Error("media save failed");
			transactionalCampsitesRepository.createPendingApproval.mockRejectedValue(error);

			await expect(
				service.create(hostId, {
					...createDto,
					media: [
						{
							url: "http://localhost:3000/uploads/campsites/pending/campsite-temp.jpg",
							type: "photo",
						},
					],
				})
			).rejects.toThrow(error);

			expect(auditRepository.save).not.toHaveBeenCalled();
			expect(unlinkMock).toHaveBeenCalledWith(
				expect.stringContaining("uploads\\campsites\\campsite-temp.jpg")
			);
		});
	});

	describe("updateMedia", () => {
		const hostId = "22222222-2222-2222-2222-222222222222";
		const campsiteId = "11111111-1111-1111-1111-111111111111";
		const updateDto = {
			media: [
				{ url: "https://example.com/campsite-new.jpg", type: "photo" as const, sortOrder: 0 },
				{ url: "https://example.com/campsite-keep.jpg", type: "photo" as const, sortOrder: 1 },
			],
		};

		it("successfully updates media for an owned campsite", async () => {
			const campsite = buildCampsite({ hostId });
			campsitesRepository.findOne.mockResolvedValue(campsite);

			const existingMedia = [
				buildMedia({ url: "https://example.com/campsite-keep.jpg", sortOrder: 2 }),
				buildMedia({ url: "https://example.com/campsite-delete.jpg", sortOrder: 0 }),
			];
			mediaRepository.find.mockResolvedValue(existingMedia);

			const result = await service.updateMedia(hostId, campsiteId, updateDto);

			expect(campsitesRepository.findOne).toHaveBeenCalledWith({ where: { id: campsiteId } });
			expect(mediaRepository.remove).toHaveBeenCalledWith([
				expect.objectContaining({ url: "https://example.com/campsite-delete.jpg" }),
			]);
			expect(mediaRepository.save).toHaveBeenCalled();
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: hostId,
					action: "campsite.media_updated",
					targetType: "campsite",
					targetId: campsiteId,
				})
			);
			expect(result).toHaveLength(2);
		});

		it("throws NotFoundException if the campsite does not exist", async () => {
			campsitesRepository.findOne.mockResolvedValue(null);

			await expect(service.updateMedia(hostId, campsiteId, updateDto)).rejects.toThrow(
				"Campsite not found"
			);
		});

		it("throws ForbiddenException if the requesting user does not own the campsite", async () => {
			const campsite = buildCampsite({ hostId: "some-other-host" });
			campsitesRepository.findOne.mockResolvedValue(campsite);

			await expect(service.updateMedia(hostId, campsiteId, updateDto)).rejects.toThrow(
				"Insufficient permission"
			);
		});
	});

	describe("search", () => {
		it("forwards DB-backed filters without city", async () => {
			await service.search(
				buildQuery({
					province: "Lam Dong",
					amenities: ["water", "shade"],
					minPrice: 100,
					maxPrice: 500,
					page: 2,
					limit: 10,
					status: CampsiteStatus.ACTIVE,
				})
			);

			expect(campsitesRepository.searchActive).toHaveBeenCalledWith(
				{
					province: "Lam Dong",
					amenities: ["water", "shade"],
					minPrice: 100,
					maxPrice: 500,
				},
				2,
				10
			);
		});

		it("maps repository coordinates into the search response location", async () => {
			const campsite = buildCampsite({
				id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				name: "Da Lat Pine Camp",
				province: "Lam Dong",
			});
			campsitesRepository.searchActive.mockResolvedValue({
				items: [
					{
						campsite,
						coverImageUrl: "https://example.com/cover.jpg",
						latitude: 11.940419,
						longitude: 108.458313,
					},
				],
				total: 1,
			} satisfies CampsiteSearchResult);

			const result = await service.search(buildQuery());

			expect(result.items).toEqual([
				{
					id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					name: "Da Lat Pine Camp",
					location: {
						province: "Lam Dong",
						latitude: 11.940419,
						longitude: 108.458313,
					},
					coverImage: "https://example.com/cover.jpg",
					activeRoutes: [],
				},
			]);
		});

		it("maps pagination totals", async () => {
			campsitesRepository.searchActive.mockResolvedValue({ items: [], total: 25 });

			const result = await service.search(buildQuery({ page: 1, limit: 10 }));

			expect(result.pagination).toEqual({ page: 1, limit: 10, total: 25, totalPages: 3 });
		});
	});

	describe("listMine", () => {
		it("returns all campsites owned by the requesting Host", async () => {
			const campsite = buildCampsite({
				id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
				status: CampsiteStatus.PENDING_APPROVAL,
			});
			campsitesRepository.findByHost.mockResolvedValue([
				{
					campsite,
					media: [buildMedia({ campsiteId: campsite.id })],
					zones: [],
					latitude: 16.1348,
					longitude: 108.114855,
				},
			]);

			const result = await service.listMine("host-id");

			expect(campsitesRepository.findByHost).toHaveBeenCalledWith("host-id");
			expect(result).toEqual([
				expect.objectContaining({
					id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
					status: CampsiteStatus.PENDING_APPROVAL,
					latitude: 16.1348,
					longitude: 108.114855,
					media: expect.arrayContaining([expect.objectContaining({ type: "photo" })]),
				}),
			]);
		});
	});

	describe("update", () => {
		const hostId = "22222222-2222-2222-2222-222222222222";
		const campsiteId = "11111111-1111-1111-1111-111111111111";

		it("allows only the owning Host to update campsite information and records change history", async () => {
			const beforeCampsite = buildCampsite({
				id: campsiteId,
				hostId,
				name: "Old Camp",
				updatedAt: new Date("2026-08-24T09:00:00.000Z"),
			});
			const afterCampsite = buildCampsite({
				id: campsiteId,
				hostId,
				name: "Updated Pine Camp",
				province: "Da Nang",
				updatedAt: new Date("2026-08-24T09:05:00.000Z"),
			});
			transactionalCampsitesRepository.findDetailedById.mockResolvedValue({
				campsite: beforeCampsite,
				media: [buildMedia({ campsiteId })],
				zones: [buildZone({ campsiteId })],
				latitude: 11.940419,
				longitude: 108.458313,
			});
			transactionalCampsitesRepository.updateInformation.mockResolvedValue({
				campsite: afterCampsite,
				media: [buildMedia({ campsiteId, url: "https://example.com/new-cover.jpg" })],
				zones: [buildZone({ campsiteId })],
				latitude: 16.1348,
				longitude: 108.114855,
			});

			const result = await service.update(hostId, campsiteId, {
				name: "Updated Pine Camp",
				latitude: 16.1348,
				longitude: 108.114855,
				province: "Da Nang",
				media: [{ url: "https://example.com/new-cover.jpg", type: "photo", sortOrder: 0 }],
				expectedUpdatedAt: "2026-08-24T09:00:00.000Z",
				changeReason: "season refresh",
			});

			expect(transactionalCampsitesRepository.findDetailedById).toHaveBeenCalledWith(
				campsiteId,
				true
			);
			expect(transactionalCampsitesRepository.updateInformation).toHaveBeenCalledWith(
				beforeCampsite,
				expect.objectContaining({
					name: "Updated Pine Camp",
					latitude: 16.1348,
					longitude: 108.114855,
					province: "Da Nang",
					media: [{ url: "https://example.com/new-cover.jpg", type: "photo", sortOrder: 0 }],
				})
			);
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: hostId,
					action: "campsite.updated",
					targetType: "campsite",
					targetId: campsiteId,
					before: expect.objectContaining({ name: "Old Camp" }),
					after: expect.objectContaining({ name: "Updated Pine Camp" }),
					reason: "season refresh",
				})
			);
			expect(result).toEqual(expect.objectContaining({ name: "Updated Pine Camp" }));
		});

		it("rejects a non-owning Host with no update, audit, or media side effects", async () => {
			transactionalCampsitesRepository.findDetailedById.mockResolvedValue({
				campsite: buildCampsite({ id: campsiteId, hostId: "other-host-id" }),
				media: [],
				zones: [],
				latitude: 11.940419,
				longitude: 108.458313,
			});

			await expect(
				service.update(hostId, campsiteId, {
					name: "Blocked edit",
					media: [
						{
							url: "http://localhost:3000/uploads/campsites/pending/blocked.jpg",
							type: "photo",
						},
					],
				})
			).rejects.toMatchObject({ status: 403 });

			expect(transactionalCampsitesRepository.updateInformation).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
			expect(renameMock).not.toHaveBeenCalled();
		});

		it("rejects stale updates before persistence", async () => {
			transactionalCampsitesRepository.findDetailedById.mockResolvedValue({
				campsite: buildCampsite({
					id: campsiteId,
					hostId,
					updatedAt: new Date("2026-08-24T09:05:00.000Z"),
				}),
				media: [],
				zones: [],
				latitude: 11.940419,
				longitude: 108.458313,
			});

			await expect(
				service.update(hostId, campsiteId, {
					name: "Stale edit",
					expectedUpdatedAt: "2026-08-24T09:00:00.000Z",
				})
			).rejects.toMatchObject({ status: 409 });

			expect(transactionalCampsitesRepository.updateInformation).not.toHaveBeenCalled();
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("rejects partial coordinate updates before opening a transaction", async () => {
			await expect(service.update(hostId, campsiteId, { latitude: 16.1348 })).rejects.toMatchObject(
				{
					status: 422,
				}
			);

			expect(dataSource.transaction).not.toHaveBeenCalled();
		});
	});
});
