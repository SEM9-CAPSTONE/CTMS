import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { RefreshToken } from "./entities/refresh-token.entity";

@Injectable()
export class RefreshTokenRepository extends Repository<RefreshToken> {
	async revokeActiveTokensForUser(userId: string, revokedAt: Date): Promise<number> {
		const result = await this.createQueryBuilder()
			.update()
			.set({ revokedAt })
			.where("user_id = :userId", { userId })
			.andWhere("revoked_at IS NULL")
			.execute();
		return result.affected ?? 0;
	}

	async revokeIfActive(id: string, revokedAt: Date): Promise<number> {
		const result = await this.createQueryBuilder()
			.update()
			.set({ revokedAt })
			.where("id = :id", { id })
			.andWhere("revoked_at IS NULL")
			.execute();
		return result.affected ?? 0;
	}
}
