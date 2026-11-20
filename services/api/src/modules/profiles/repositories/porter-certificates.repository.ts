import { Injectable } from "@nestjs/common";
// biome-ignore lint/style/useImportType: NestJS DI needs runtime DataSource
import { DataSource, IsNull, Repository } from "typeorm";
import type { AvailablePorterCertificateDto } from "../dto/porter-certificate.dto";
import {
	PorterCertificate,
	PorterCertificateStatus,
	type PorterCertificateType,
} from "../entities/porter-certificate.entity";

export interface AdminCertificateRow {
	id: string;
	porterId: string;
	porterName: string | null;
	porterEmail: string | null;
	porterAvatarUrl: string | null;
	type: PorterCertificateType;
	name: string;
	certificateNumber: string | null;
	issuedBy: string | null;
	issuedDate: string | null;
	expiryDate: string | null;
	fileUrl: string | null;
	status: PorterCertificateStatus;
	rejectionReason: string | null;
	verifiedBy: string | null;
	verifiedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
}

@Injectable()
export class PorterCertificatesRepository extends Repository<PorterCertificate> {
	constructor(private readonly dataSource: DataSource) {
		super(PorterCertificate, dataSource.createEntityManager());
	}

	async findActiveByPorterId(porterId: string): Promise<PorterCertificate[]> {
		return this.find({
			where: {
				porterId,
				deletedAt: IsNull(),
			},
			order: {
				createdAt: "DESC",
			},
		});
	}

	async findActiveById(id: string): Promise<PorterCertificate | null> {
		return this.findOne({
			where: {
				id,
				deletedAt: IsNull(),
			},
		});
	}

	async findDuplicate(
		porterId: string,
		type: PorterCertificateType,
		certificateNumber: string,
		excludeId?: string
	): Promise<PorterCertificate | null> {
		const cleanNumber = certificateNumber.trim();
		if (!cleanNumber) return null;

		const qb = this.createQueryBuilder("c")
			.where("c.porter_id = :porterId", { porterId })
			.andWhere("c.type = :type", { type })
			.andWhere("LOWER(TRIM(c.certificate_number)) = LOWER(:cleanNumber)", { cleanNumber })
			.andWhere("c.deleted_at IS NULL");

		if (excludeId) {
			qb.andWhere("c.id != :excludeId", { excludeId });
		}

		return qb.getOne();
	}

	async findAllForAdmin(
		status?: PorterCertificateStatus | "expired"
	): Promise<AdminCertificateRow[]> {
		const parameters: unknown[] = [];
		let whereClause = "WHERE c.deleted_at IS NULL";

		if (status === "expired") {
			whereClause += " AND c.expiry_date < CURRENT_DATE";
		} else if (status) {
			parameters.push(status);
			whereClause += ` AND c.status = $${parameters.length}`;
		}

		const sql = `
			SELECT
				c.id,
				c.porter_id AS "porterId",
				u.full_name AS "porterName",
				u.email AS "porterEmail",
				u.avatar_url AS "porterAvatarUrl",
				c.type,
				c.name,
				c.certificate_number AS "certificateNumber",
				c.issued_by AS "issuedBy",
				c.issued_date AS "issuedDate",
				c.expiry_date AS "expiryDate",
				c.file_url AS "fileUrl",
				c.status,
				c.rejection_reason AS "rejectionReason",
				c.verified_by AS "verifiedBy",
				c.verified_at AS "verifiedAt",
				c.created_at AS "createdAt",
				c.updated_at AS "updatedAt"
			FROM porter_certificates c
			INNER JOIN users u ON u.id = c.porter_id
			${whereClause}
			ORDER BY
				CASE c.status
					WHEN 'pending' THEN 1
					WHEN 'rejected' THEN 2
					WHEN 'verified' THEN 3
					ELSE 4
				END ASC,
				c.created_at DESC
		`;

		return this.query(sql, parameters) as Promise<AdminCertificateRow[]>;
	}

	/**
	 * Batch query verified, non-expired certificates for a list of porter IDs.
	 * $O(1)$ query count to prevent N+1 queries in Available Porters API.
	 * Returns ONLY type and name as required for Host view.
	 */
	async findVerifiedNonExpiredByPorterIds(
		porterIds: string[]
	): Promise<Map<string, AvailablePorterCertificateDto[]>> {
		const map = new Map<string, AvailablePorterCertificateDto[]>();
		if (!porterIds || porterIds.length === 0) return map;

		for (const id of porterIds) {
			map.set(id, []);
		}

		const sql = `
			SELECT
				c.porter_id AS "porterId",
				c.type,
				c.name
			FROM porter_certificates c
			WHERE c.porter_id = ANY($1)
				AND c.status = '${PorterCertificateStatus.VERIFIED}'
				AND (c.expiry_date IS NULL OR c.expiry_date >= CURRENT_DATE)
				AND c.deleted_at IS NULL
			ORDER BY c.created_at ASC
		`;

		const rows = (await this.query(sql, [porterIds])) as Array<{
			porterId: string;
			type: PorterCertificateType;
			name: string;
		}>;

		for (const row of rows) {
			const list = map.get(row.porterId) ?? [];
			list.push({
				type: row.type,
				name: row.name,
			});
			map.set(row.porterId, list);
		}

		return map;
	}
}
