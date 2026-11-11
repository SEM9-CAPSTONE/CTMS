import { createHash } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnprocessableEntityException,
} from "@nestjs/common";
import { isUUID } from "class-validator";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { IncidentMediaStorage } from "../../incidents/incident-media.storage";
interface Draft {
	id: string;
	host_id: string;
	values: Record<string, unknown>;
	completed_trip_id: string | null;
	trip_id: string | null;
	updated_at: Date;
}
const FIELDS = [
	"routeId",
	"title",
	"description",
	"coverImageUrl",
	"tripType",
	"startsAt",
	"endsAt",
	"meetingLongitude",
	"meetingLatitude",
	"meetingAt",
	"bookingDeadline",
	"capacityMin",
	"capacityMax",
	"pricePerPerson",
];
@Injectable()
export class TripFormDraftsService {
	constructor(private readonly db: DataSource) {}
	private values(raw: string): Record<string, unknown> {
		let value: unknown;
		try {
			value = JSON.parse(raw);
		} catch {
			throw new UnprocessableEntityException("Invalid draft values");
		}
		if (!value || typeof value !== "object" || Array.isArray(value))
			throw new UnprocessableEntityException("Invalid draft values");
		const values = value as Record<string, unknown>;
		if (
			Object.keys(values).some((key) => !FIELDS.includes(key) && key !== "waypoints") ||
			FIELDS.some(
				(key) =>
					typeof values[key] !== "string" ||
					(values[key] as string).length > (key === "description" ? 10000 : 500)
			) ||
			!Array.isArray(values.waypoints) ||
			values.waypoints.length > 100
		)
			throw new UnprocessableEntityException("Invalid draft values");
		if (
			values.waypoints.some(
				(item) =>
					!item ||
					typeof item !== "object" ||
					Array.isArray(item) ||
					Object.entries(item).some(
						([key, v]) =>
							!["type", "name", "longitude", "latitude", "plannedAt"].includes(key) ||
							typeof v !== "string" ||
							v.length > 500
					)
			)
		)
			throw new UnprocessableEntityException("Invalid draft waypoints");
		return values;
	}
	private async owned(m: EntityManager, host: string, id: string, lock = false): Promise<Draft> {
		const [draft]: Draft[] = await m.query(
			`SELECT id,host_id,form_values AS "values",completed_trip_id,trip_id,updated_at FROM trip_form_drafts WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
			[id]
		);
		if (!draft) throw new NotFoundException("Trip draft not found");
		if (draft.host_id !== host)
			throw new ForbiddenException("Only the owning Host can access this draft");
		return draft;
	}
	async list(host: string): Promise<
		{
			id: string;
			title: string;
			updatedAt: Date;
			tripId: string | null;
			imageCount: number;
			startsAt: string;
			endsAt: string;
			capacityMax: string;
			pricePerPerson: string;
		}[]
	> {
		return this.db.query(
			`SELECT id,form_values->>'title' AS title,updated_at AS "updatedAt",trip_id AS "tripId",
   form_values->>'startsAt' AS "startsAt",form_values->>'endsAt' AS "endsAt",
   form_values->>'capacityMax' AS "capacityMax",form_values->>'pricePerPerson' AS "pricePerPerson",
   (SELECT count(*)::int FROM trip_form_draft_images WHERE draft_id=d.id) AS "imageCount"
   FROM trip_form_drafts d WHERE host_id=$1 AND completed_trip_id IS NULL ORDER BY updated_at DESC,id`,
			[host]
		);
	}
	async thumbnail(host: string, id: string) {
		return this.db.transaction(async (m) => {
			const draft = await this.owned(m, host, id, true);
			if (draft.completed_trip_id)
				throw new ConflictException("This draft has already become a Trip");
			const rows: { filename: string; media_type: string; bytes: Buffer }[] = await m.query(
				"SELECT filename,media_type,bytes FROM trip_form_draft_images WHERE draft_id=$1 ORDER BY sort_order LIMIT 1",
				[id]
			);
			const first = rows[0];
			return first
				? { name: first.filename, type: first.media_type, base64: first.bytes.toString("base64") }
				: null;
		});
	}

	async get(host: string, id: string) {
		return this.db.transaction(async (m) => {
			const draft = await this.owned(m, host, id, true);
			if (draft.completed_trip_id)
				throw new ConflictException("This draft has already become a Trip");
			const rows: { filename: string; media_type: string; bytes: Buffer }[] = await m.query(
				"SELECT filename,media_type,bytes FROM trip_form_draft_images WHERE draft_id=$1 ORDER BY sort_order",
				[id]
			);
			return {
				id,
				values: draft.values,
				tripId: draft.trip_id,
				images: rows.map((row) => ({
					name: row.filename,
					type: row.media_type,
					base64: row.bytes.toString("base64"),
				})),
			};
		});
	}
	async save(
		host: string,
		id: string,
		raw: string,
		files: Express.Multer.File[],
		tripId?: string,
		preserveImages = false
	) {
		const values = this.values(raw);
		if (preserveImages && files.length)
			throw new UnprocessableEntityException(
				"Cannot replace and preserve draft images in one request"
			);
		if (files.length > 5)
			throw new UnprocessableEntityException("A draft supports at most five images");
		const images = [
			...new Map(
				files.map((file) => {
					const signature = new IncidentMediaStorage().detectImage(file.buffer);
					if (
						!signature ||
						signature.contentType !== file.mimetype ||
						file.buffer.length > 5242880 ||
						file.originalname.length > 255
					)
						throw new UnprocessableEntityException("Use JPG, PNG or WebP images up to 5 MB");
					return [createHash("sha256").update(file.buffer).digest("hex"), file] as const;
				})
			).entries(),
		];
		return this.db.transaction(async (m) => {
			if (values.routeId) {
				if (!isUUID(values.routeId)) throw new UnprocessableEntityException("Invalid route");
				const [route]: { host_id: string }[] = await m.query(
					"SELECT host_id FROM trekking_routes WHERE id=$1",
					[values.routeId]
				);
				if (!route) throw new NotFoundException("Route not found");
				if (route.host_id !== host) throw new ForbiddenException("Route belongs to another Host");
			}
			if (preserveImages) await this.owned(m, host, id, true);
			await m.query(
				"INSERT INTO trip_form_drafts(id,host_id,form_values) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
				[id, host, values]
			);
			const existing = await this.owned(m, host, id, true);
			if (tripId) {
				const [trip]: { host_id: string; status: string }[] = await m.query(
					"SELECT host_id,status FROM trips WHERE id=$1",
					[tripId]
				);
				if (!trip) throw new NotFoundException("Trip not found");
				if (trip.host_id !== host) throw new ForbiddenException("Trip belongs to another Host");
				if (trip.status !== "draft")
					throw new ConflictException("Only an editable draft Trip can resume image uploads");
			}
			if (existing.trip_id && tripId !== existing.trip_id)
				throw new ConflictException("Draft is already linked to another Trip");

			if (existing.completed_trip_id)
				throw new ConflictException("This draft has already become a Trip");
			await m.query(
				"UPDATE trip_form_drafts SET form_values=$2,trip_id=$3,updated_at=now() WHERE id=$1",
				[id, values, tripId ?? null]
			);
			if (!preserveImages) {
				await m.query("DELETE FROM trip_form_draft_images WHERE draft_id=$1", [id]);
				for (const [index, [hash, file]] of images.entries())
					await m.query(
						"INSERT INTO trip_form_draft_images(draft_id,filename,media_type,content_hash,bytes,sort_order) VALUES($1,$2,$3,$4,$5,$6)",
						[id, file.originalname, file.mimetype, hash, file.buffer, index]
					);
			}
			await m.getRepository(AuditLog).save({
				actorId: host,
				action: "trip.form_draft_saved",
				targetType: "trip_form_draft",
				targetId: id,
				after: preserveImages ? { imagesPreserved: true } : { imageCount: images.length },
				reason: "host_save_form_draft",
			});
			return { id };
		});
	}
	async complete(host: string, id: string, tripId: string) {
		return this.db.transaction(async (m) => {
			const draft = await this.owned(m, host, id, true);
			if (draft.completed_trip_id) {
				if (draft.completed_trip_id !== tripId)
					throw new ConflictException("Draft already processed");
				return { id, tripId };
			}
			if (draft.trip_id && draft.trip_id !== tripId)
				throw new ConflictException("Draft is linked to another Trip");
			const [trip]: { host_id: string }[] = await m.query("SELECT host_id FROM trips WHERE id=$1", [
				tripId,
			]);
			if (!trip) throw new NotFoundException("Trip not found");
			if (trip.host_id !== host) throw new ForbiddenException("Trip belongs to another Host");
			await m.query(
				"UPDATE trip_form_drafts SET completed_trip_id=$2,updated_at=now() WHERE id=$1",
				[id, tripId]
			);
			await m.query("DELETE FROM trip_form_draft_images WHERE draft_id=$1", [id]);
			return { id, tripId };
		});
	}
}
