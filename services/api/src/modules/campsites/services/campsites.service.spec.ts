import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
import type { CampsiteImage } from "../entities/campsite-image.entity";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import type {
	CampsiteSearchResult,
	CampsitesRepository,
	CreatedDraftCampsite,
} from "../repositories/campsites.repository";
import { CampsitesService } from "./campsites.service";

function buildCampsite(overrides: Partial<Campsite> = {}): Campsite {
	return {
		id: "11111111-1111-1111-1111-111111111111",
		hostId: "22222222-2222-2222-2222-222222222222",
		host: undefined as unknown as Campsite["host"],
		name: "Fixture Campsite",
		description: "desc",
		latitude: "10.111111",
		longitude: "106.222222",
		province: "Lam Dong",
		city: "Da Lat",
		policies: "n/a",
		operatingHours: "n/a",
		status: CampsiteStatus.ACTIVE,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

function buildImage(overrides: Partial<CampsiteImage> = {}): CampsiteImage {
	return {
		id: "33333333-3333-3333-3333-333333333333",
		campsiteId: "11111111-1111-1111-1111-111111111111",
		campsite: undefined as unknown as CampsiteImage["campsite"],
		url: "https://example.com/campsite.jpg",
		type: "photo",
		displayOrder: 0,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
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
	let campsitesRepository: { searchActive: jest.Mock; createDraft: jest.Mock };
	let transactionalCampsitesRepository: { createDraft: jest.Mock };
	let auditRepository: { save: jest.Mock };
	let dataSource: { transaction: jest.Mock };

	beforeEach(() => {
		transactionalCampsitesRepository = {
			createDraft: jest.fn(),
		};
		auditRepository = {
			save: jest.fn(),
		};
		campsitesRepository = {
			searchActive: jest
				.fn()
				.mockResolvedValue({ items: [], total: 0 } satisfies CampsiteSearchResult),
			createDraft: jest.fn(),
		};
		dataSource = {
			transaction: jest.fn(async (callback: (manager: unknown) => unknown) =>
				callback({
					withRepository: jest.fn().mockReturnValue(transactionalCampsitesRepository),
					getRepository: jest.fn().mockReturnValue(auditRepository),
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
			city: "Da Lat",
			policies: "No campfires after 21:00",
			operatingHours: "08:00-18:00",
			initialImages: [
				{ url: "https://example.com/cover.jpg", type: "photo" as const },
				{ url: "https://example.com/map.jpg", type: "photo" as const, displayOrder: 5 },
			],
		};

		it("creates a draft campsite for the requesting Host and writes an audit log in one transaction", async () => {
			const campsite = buildCampsite({
				hostId,
				name: createDto.name,
				status: CampsiteStatus.DRAFT,
				latitude: "11.940419",
				longitude: "108.458313",
			});
			const images = [buildImage(), buildImage({ id: "44444444-4444-4444-4444-444444444444" })];
			transactionalCampsitesRepository.createDraft.mockResolvedValue({
				campsite,
				images,
			} satisfies CreatedDraftCampsite);

			const result = await service.create(hostId, createDto);

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(transactionalCampsitesRepository.createDraft).toHaveBeenCalledWith({
				hostId,
				name: "Da Lat Pine Camp",
				description: "Quiet campsite in the pine forest",
				latitude: "11.940419",
				longitude: "108.458313",
				province: "Lam Dong",
				city: "Da Lat",
				policies: "No campfires after 21:00",
				operatingHours: "08:00-18:00",
				initialImages: [
					{ url: "https://example.com/cover.jpg", type: "photo", displayOrder: undefined },
					{ url: "https://example.com/map.jpg", type: "photo", displayOrder: 5 },
				],
			});
			expect(auditRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					actorId: hostId,
					action: "campsite.created",
					targetType: "campsite",
					targetId: campsite.id,
					before: null,
					after: expect.objectContaining({
						hostId,
						status: CampsiteStatus.DRAFT,
						images: expect.arrayContaining([
							expect.objectContaining({ url: "https://example.com/campsite.jpg" }),
						]),
					}),
					reason: "host_create_campsite",
				})
			);
			expect(result).toEqual(
				expect.objectContaining({
					id: campsite.id,
					hostId,
					name: "Da Lat Pine Camp",
					status: CampsiteStatus.DRAFT,
					latitude: 11.940419,
					longitude: 108.458313,
					images: expect.arrayContaining([
						expect.objectContaining({ url: "https://example.com/campsite.jpg" }),
					]),
				})
			);
		});

		it("defaults omitted image type to photo before persistence", async () => {
			transactionalCampsitesRepository.createDraft.mockResolvedValue({
				campsite: buildCampsite({ status: CampsiteStatus.DRAFT }),
				images: [buildImage()],
			} satisfies CreatedDraftCampsite);

			await service.create(hostId, {
				...createDto,
				initialImages: [{ url: "https://example.com/cover.jpg" }],
			});

			expect(transactionalCampsitesRepository.createDraft).toHaveBeenCalledWith(
				expect.objectContaining({
					initialImages: [
						{ url: "https://example.com/cover.jpg", type: "photo", displayOrder: undefined },
					],
				})
			);
		});

		it("propagates create failures so the transaction can roll back without an audit log", async () => {
			const error = new Error("image save failed");
			transactionalCampsitesRepository.createDraft.mockRejectedValue(error);

			await expect(service.create(hostId, createDto)).rejects.toThrow(error);

			expect(dataSource.transaction).toHaveBeenCalledTimes(1);
			expect(auditRepository.save).not.toHaveBeenCalled();
		});

		it("propagates audit-log failures so campsite and images roll back together", async () => {
			transactionalCampsitesRepository.createDraft.mockResolvedValue({
				campsite: buildCampsite({ status: CampsiteStatus.DRAFT }),
				images: [buildImage()],
			} satisfies CreatedDraftCampsite);
			const auditError = new Error("audit failed");
			auditRepository.save.mockRejectedValue(auditError);

			await expect(service.create(hostId, createDto)).rejects.toThrow(auditError);

			expect(transactionalCampsitesRepository.createDraft).toHaveBeenCalledTimes(1);
			expect(auditRepository.save).toHaveBeenCalledTimes(1);
		});
	});

	describe("search", () => {
		it("forwards exactly the filter/page/limit fields from the query DTO to the repository", async () => {
			await service.search(
				buildQuery({
					province: "Lam Dong",
					city: "Da Lat",
					amenities: ["wifi", "bbq"],
					minPrice: 100,
					maxPrice: 500,
					page: 2,
					limit: 10,
					// `status` deliberately included to prove it is NOT forwarded --
					// the repository's active-only invariant must not depend on the
					// service stripping it correctly by coincidence.
					status: CampsiteStatus.ACTIVE,
				})
			);

			expect(campsitesRepository.searchActive).toHaveBeenCalledTimes(1);
			expect(campsitesRepository.searchActive).toHaveBeenCalledWith(
				{
					province: "Lam Dong",
					city: "Da Lat",
					amenities: ["wifi", "bbq"],
					minPrice: 100,
					maxPrice: 500,
				},
				2,
				10
			);
		});

		it("passes undefined through for filters the caller omitted, rather than inventing defaults", async () => {
			await service.search(buildQuery());

			expect(campsitesRepository.searchActive).toHaveBeenCalledWith(
				{
					province: undefined,
					city: undefined,
					amenities: undefined,
					minPrice: undefined,
					maxPrice: undefined,
				},
				1,
				20
			);
		});

		it("maps a repository row into the response item shape exactly, including activeRoutes: []", async () => {
			const campsite = buildCampsite({
				id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
				name: "Da Lat Pine Camp",
				province: "Lam Dong",
				city: "Da Lat",
				latitude: "11.940419",
				longitude: "108.458313",
			});
			campsitesRepository.searchActive.mockResolvedValue({
				items: [{ campsite, coverImageUrl: "https://example.com/cover.jpg" }],
				total: 1,
			} satisfies CampsiteSearchResult);

			const result = await service.search(buildQuery());

			expect(result.items).toEqual([
				{
					id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
					name: "Da Lat Pine Camp",
					location: {
						province: "Lam Dong",
						city: "Da Lat",
						latitude: 11.940419,
						longitude: 108.458313,
					},
					coverImage: "https://example.com/cover.jpg",
					activeRoutes: [],
				},
			]);
		});

		it("maps a null coverImageUrl straight through to coverImage: null", async () => {
			campsitesRepository.searchActive.mockResolvedValue({
				items: [{ campsite: buildCampsite(), coverImageUrl: null }],
				total: 1,
			} satisfies CampsiteSearchResult);

			const result = await service.search(buildQuery());

			expect(result.items[0].coverImage).toBeNull();
		});

		it("preserves item order and count as returned by the repository (no re-sorting/filtering in the service)", async () => {
			const first = buildCampsite({ id: "1", name: "First" });
			const second = buildCampsite({ id: "2", name: "Second" });
			campsitesRepository.searchActive.mockResolvedValue({
				items: [
					{ campsite: first, coverImageUrl: null },
					{ campsite: second, coverImageUrl: null },
				],
				total: 2,
			} satisfies CampsiteSearchResult);

			const result = await service.search(buildQuery());

			expect(result.items.map((item) => item.id)).toEqual(["1", "2"]);
		});

		describe("pagination.totalPages", () => {
			it("is 0 when total is 0, not NaN or Infinity", async () => {
				campsitesRepository.searchActive.mockResolvedValue({ items: [], total: 0 });

				const result = await service.search(buildQuery({ page: 1, limit: 20 }));

				expect(result.pagination).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
			});

			it("rounds up for a total that isn't an exact multiple of limit", async () => {
				campsitesRepository.searchActive.mockResolvedValue({ items: [], total: 25 });

				const result = await service.search(buildQuery({ page: 1, limit: 10 }));

				expect(result.pagination.totalPages).toBe(3);
			});

			it("does not add an extra page when total is an exact multiple of limit", async () => {
				campsitesRepository.searchActive.mockResolvedValue({ items: [], total: 20 });

				const result = await service.search(buildQuery({ page: 1, limit: 20 }));

				expect(result.pagination.totalPages).toBe(1);
			});

			it("echoes back the requested page/limit regardless of how many items came back", async () => {
				campsitesRepository.searchActive.mockResolvedValue({ items: [], total: 47 });

				const result = await service.search(buildQuery({ page: 3, limit: 15 }));

				expect(result.pagination.page).toBe(3);
				expect(result.pagination.limit).toBe(15);
				expect(result.pagination.total).toBe(47);
			});
		});
	});
});
