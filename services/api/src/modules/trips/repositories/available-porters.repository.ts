import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import {
	PorterAvailabilityStatus,
	type PorterProfile,
} from "../../profiles/entities/porter-profile.entity";
import { PorterRouteProficiency } from "../../profiles/entities/porter-route-qualification.entity";
import { UserRole, UserStatus } from "../../users/entities/user.entity";
import type { AvailablePorterResponseDto } from "../dto/available-porter-response.dto";
import { IntendedPorterRole } from "../dto/available-porters-query.dto";

export interface AvailablePorterFilter {
	routeId: string;
	role: IntendedPorterRole;
	minExperienceYears?: number;
	excludedPorterIds: string[];
	page: number;
	limit: number;
}

export interface AvailablePorterPage {
	items: AvailablePorterResponseDto[];
	total: number;
}

interface AvailablePorterRow {
	porterId: string;
	displayName: string | null;
	experienceYears: number | string;
	availabilityStatus: PorterAvailabilityStatus;
	ratingAvg: number | string;
	completedTrips: number | string;
	proficiency: PorterRouteProficiency | null;
}

@Injectable()
export class AvailablePortersRepository extends Repository<PorterProfile> {
	async findEligibleCandidates(filters: AvailablePorterFilter): Promise<AvailablePorterPage> {
		const parameters: unknown[] = [
			UserStatus.ACTIVE,
			UserRole.PORTER,
			PorterAvailabilityStatus.AVAILABLE,
		];
		const conditions = [
			`candidate."status" = $1`,
			`(
				EXISTS (
					SELECT 1 FROM "user_roles" granted_role
					WHERE granted_role."user_id" = candidate."id" AND granted_role."role" = $2
				)
				OR (
					NOT EXISTS (
						SELECT 1 FROM "user_roles" any_role
						WHERE any_role."user_id" = candidate."id"
					)
					AND candidate."role" = $2
				)
			)`,
			`profile."availability_status" = $3`,
		];

		if (filters.minExperienceYears != null) {
			parameters.push(filters.minExperienceYears);
			conditions.push(`profile."experience_years" >= $${parameters.length}`);
		}

		if (filters.excludedPorterIds.length > 0) {
			parameters.push(filters.excludedPorterIds);
			conditions.push(`NOT (profile."porter_id" = ANY($${parameters.length}::uuid[]))`);
		}

		parameters.push(filters.routeId);
		const routeParameter = parameters.length;
		if (filters.role === IntendedPorterRole.LEAD) {
			parameters.push([PorterRouteProficiency.PROFICIENT, PorterRouteProficiency.EXPERT]);
			conditions.push(
				`qualification."proficiency" = ANY($${parameters.length}::porter_route_proficiency[])`,
				`qualification."verified_by" IS NOT NULL`,
				`qualification."verified_at" IS NOT NULL`
			);
		}

		const fromClause = `
			FROM "porter_profiles" profile
			INNER JOIN "users" candidate ON candidate."id" = profile."porter_id"
			LEFT JOIN "porter_route_qualifications" qualification
				ON qualification."porter_id" = profile."porter_id"
				AND qualification."route_id" = $${routeParameter}`;
		const whereClause = `WHERE ${conditions.join(" AND ")}`;

		const countRows = (await this.query(
			`SELECT COUNT(*)::int AS "total" ${fromClause} ${whereClause}`,
			parameters
		)) as Array<{ total: number | string }>;

		const listParameters = [...parameters, filters.limit, (filters.page - 1) * filters.limit];
		const rows = (await this.query(
			`SELECT
				profile."porter_id" AS "porterId",
				candidate."full_name" AS "displayName",
				profile."experience_years" AS "experienceYears",
				profile."availability_status" AS "availabilityStatus",
				profile."rating_avg" AS "ratingAvg",
				profile."completed_trips" AS "completedTrips",
				qualification."proficiency" AS "proficiency"
			 ${fromClause}
			 ${whereClause}
			 ORDER BY profile."porter_id" ASC
			 LIMIT $${listParameters.length - 1} OFFSET $${listParameters.length}`,
			listParameters
		)) as AvailablePorterRow[];

		return {
			items: rows.map((row) => ({
				porterId: row.porterId,
				displayName: row.displayName,
				experienceYears: Number(row.experienceYears),
				availabilityStatus: row.availabilityStatus,
				ratingAvg: Number(row.ratingAvg),
				completedTrips: Number(row.completedTrips),
				...(filters.role === IntendedPorterRole.LEAD && row.proficiency
					? { proficiency: row.proficiency }
					: {}),
			})),
			total: Number(countRows[0]?.total ?? 0),
		};
	}
}
