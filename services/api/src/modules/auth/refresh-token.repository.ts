import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { RefreshToken } from "./entities/refresh-token.entity";

/**
 * Same factory-provider pattern as UsersRepository / VerificationOtpRepository
 * (the project's only established repository convention — confirmed by
 * `grep -rn "InjectRepository" src` returning zero matches anywhere in the
 * codebase). Empty body: `save`/`findOneBy` inherited from Repository<T> are
 * all CTMS-03 needs; no custom query method required yet.
 */
@Injectable()
export class RefreshTokenRepository extends Repository<RefreshToken> {}
