import { ApiProperty } from "@nestjs/swagger";
import type { AuditLog } from "../entities/audit-log.entity";

export class AuditLogItemDto {
	@ApiProperty({ format: "uuid" })
	id!: string;

	@ApiProperty({ format: "uuid", nullable: true })
	actorId!: string | null;

	@ApiProperty()
	action!: string;

	@ApiProperty()
	targetType!: string;

	@ApiProperty({ format: "uuid" })
	targetId!: string;

	@ApiProperty({ type: "object", nullable: true })
	before!: Record<string, unknown> | null;

	@ApiProperty({ type: "object", nullable: true })
	after!: Record<string, unknown> | null;

	@ApiProperty({ type: String, nullable: true })
	reason!: string | null;

	@ApiProperty()
	createdAt!: Date;
}

export class AuditLogsPaginationDto {
	@ApiProperty()
	page!: number;

	@ApiProperty()
	limit!: number;

	@ApiProperty()
	total!: number;

	@ApiProperty()
	totalPages!: number;
}

export class PaginatedAuditLogsResponseDto {
	@ApiProperty({ type: [AuditLogItemDto] })
	items!: AuditLogItemDto[];

	@ApiProperty({ type: AuditLogsPaginationDto })
	pagination!: AuditLogsPaginationDto;
}

export function maskSensitiveFields(
	obj: Record<string, unknown> | null
): Record<string, unknown> | null {
	if (!obj) return null;
	const sensitiveKeys = [
		"password",
		"passwordhash",
		"password_hash",
		"code",
		"codehash",
		"code_hash",
		"token",
		"tokenhash",
		"token_hash",
		"refreshtoken",
		"refresh_token",
		"accesstoken",
		"access_token",
	];

	const sanitized = { ...obj };
	for (const key of Object.keys(sanitized)) {
		const lowerKey = key.toLowerCase();
		if (sensitiveKeys.some((sKey) => lowerKey.includes(sKey))) {
			sanitized[key] = "[MASKED]";
		} else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
			sanitized[key] = maskSensitiveFields(sanitized[key] as Record<string, unknown>);
		}
	}
	return sanitized;
}

export function toAuditLogItem(log: AuditLog): AuditLogItemDto {
	return {
		id: log.id,
		actorId: log.actorId,
		action: log.action,
		targetType: log.targetType,
		targetId: log.targetId,
		before: maskSensitiveFields(log.before),
		after: maskSensitiveFields(log.after),
		reason: log.reason,
		createdAt: log.createdAt,
	};
}
