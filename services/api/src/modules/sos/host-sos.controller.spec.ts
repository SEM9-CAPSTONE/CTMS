import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import { HostSosController } from "./host-sos.controller";
import type { SosService } from "./sos.service";

describe("HostSosController", () => {
	let controller: HostSosController;
	let sosService: {
		listForHost: jest.Mock;
	};

	const mockUser: AuthenticatedUser = {
		userId: "11111111-1111-4111-8111-111111111111",
		email: "host@ctms.local",
		role: UserRole.HOST,
		roles: [UserRole.HOST],
	};

	beforeEach(() => {
		sosService = {
			listForHost: jest.fn().mockResolvedValue({
				items: [],
				total: 0,
				page: 1,
				limit: 10,
			}),
		};

		controller = new HostSosController(sosService as unknown as SosService);
	});

	it("delegates listForHost call to SosService with user ID and query", async () => {
		const query = { page: 2, limit: 10 };
		const result = await controller.listForHost({ user: mockUser }, query);

		expect(sosService.listForHost).toHaveBeenCalledWith(mockUser.userId, query);
		expect(result).toEqual({
			items: [],
			total: 0,
			page: 1,
			limit: 10,
		});
	});
});
