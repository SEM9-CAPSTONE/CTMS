import { ConflictException } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { TermsVersion } from "./entities/terms-version.entity";
import { UserTermsAcceptance } from "./entities/user-terms-acceptance.entity";
import { type TermsPlatform, normalizeTermsVersion } from "./terms-content";

export const TERMS_VERSION_OUTDATED_CODE = "TERMS_VERSION_OUTDATED";
export const TERMS_VERSION_OUTDATED_MESSAGE =
	"Điều khoản sử dụng đã được cập nhật phiên bản mới. Vui lòng xem lại và xác nhận trước khi tiếp tục.";

export async function recordRegistrationTermsAcceptance(
	manager: EntityManager,
	params: {
		userId: string;
		acceptedTermsVersion: string;
		platform?: TermsPlatform;
	}
): Promise<UserTermsAcceptance> {
	const termsVersionRepo = manager.getRepository(TermsVersion);
	const acceptanceRepo = manager.getRepository(UserTermsAcceptance);

	const activeVersion = await termsVersionRepo.findOne({
		where: { isActive: true },
		order: { publishedAt: "DESC" },
	});

	const normalizedRequested = normalizeTermsVersion(params.acceptedTermsVersion);
	if (!activeVersion || activeVersion.version !== normalizedRequested) {
		throw new ConflictException({
			statusCode: 409,
			code: TERMS_VERSION_OUTDATED_CODE,
			message: TERMS_VERSION_OUTDATED_MESSAGE,
			currentVersion: activeVersion?.version ?? null,
			currentEffectiveDate: activeVersion?.effectiveDate ?? null,
		});
	}

	return acceptanceRepo.save({
		userId: params.userId,
		termsVersionId: activeVersion.id,
		version: activeVersion.version,
		acceptedAt: new Date(),
		source: "registration",
		platform: params.platform ?? "api",
	});
}
