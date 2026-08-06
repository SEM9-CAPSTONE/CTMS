import type { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy";

function buildConfigService(secret = "test-secret"): ConfigService {
	return { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
}

describe("JwtStrategy.validate", () => {
	it("maps the JWT payload's sub/roles claims to { userId, roles }", () => {
		const strategy = new JwtStrategy(buildConfigService());

		const result = strategy.validate({
			sub: "11111111-1111-1111-1111-111111111111",
			roles: ["camper"],
		});

		expect(result).toEqual({ userId: "11111111-1111-1111-1111-111111111111", roles: ["camper"] });
	});
});
