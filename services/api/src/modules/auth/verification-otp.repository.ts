import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import type { VerificationOtp } from "./entities/verification-otp.entity";

/**
 * Recreated at Step 4 — removed empty at Step 1 review (no consumer yet at
 * the time). Now `AuthService.issueOtp()` (Step 4) is the real consumer, so
 * the class is justified: same factory-provider/transaction pattern as
 * UsersRepository. `findOneBy`/`save` used by issueOtp are inherited from
 * `Repository<VerificationOtp>` — no custom query method needed yet.
 */
@Injectable()
export class VerificationOtpRepository extends Repository<VerificationOtp> {}
