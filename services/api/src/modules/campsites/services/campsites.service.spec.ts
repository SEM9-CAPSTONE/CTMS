import type { SearchCampsitesQueryDto } from "../dto/search-campsites-query.dto";
import { type Campsite, CampsiteStatus } from "../entities/campsite.entity";
import type {
	CampsiteSearchResult,
	CampsitesRepository,
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

function buildQuery(overrides: Partial<SearchCampsitesQueryDto> = {}): SearchCampsitesQueryDto {
	return {
		page: 1,
		limit: 20,
		...overrides,
	};
}

describe("CampsitesService", () => {
	let service: CampsitesService;
	let campsitesRepository: { searchActive: jest.Mock };

	beforeEach(() => {
		campsitesRepository = {
			searchActive: jest
				.fn()
				.mockResolvedValue({ items: [], total: 0 } satisfies CampsiteSearchResult),
		};
		service = new CampsitesService(campsitesRepository as unknown as CampsitesRepository);
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
