import { CampsiteMedia } from "../entities/campsite-media.entity";
import { CampsiteStatus } from "../entities/campsite.entity";
import { CampsitesRepository } from "./campsites.repository";

describe("CampsitesRepository", () => {
	it("persists campsite locations as GeoJSON points for TypeORM geography columns", async () => {
		const repository = new CampsitesRepository({} as never, {} as never);
		const savedCampsite = { id: "campsite-id" };
		const create = jest.spyOn(repository, "create").mockImplementation((input) => input as never);
		const save = jest.spyOn(repository, "save").mockResolvedValue(savedCampsite as never);
		const mediaRepository = {
			create: jest.fn((input) => input),
			save: jest.fn().mockResolvedValue([]),
		};
		const zoneRepository = {
			create: jest.fn((input) => input),
			save: jest.fn().mockResolvedValue([]),
		};

		Object.defineProperty(repository, "manager", {
			value: {
				getRepository: jest.fn((entity) =>
					entity === CampsiteMedia ? mediaRepository : zoneRepository
				),
			},
		});

		await repository.createPendingApproval({
			hostId: "host-id",
			name: "Hai Van",
			description: "desc",
			latitude: 16.1348,
			longitude: 108.114855,
			province: "Da Nang",
			policies: { rules: "No fire" },
			operatingHours: { opensAt: "06:00", closesAt: "20:00" },
			media: [{ url: "http://localhost:3000/uploads/campsites/camp.jpg", type: "photo" }],
		});

		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				location: {
					type: "Point",
					coordinates: [108.114855, 16.1348],
				},
				status: CampsiteStatus.PENDING_APPROVAL,
			})
		);
		expect(save).toHaveBeenCalled();
	});
});
