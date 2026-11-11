import { createHash } from "node:crypto";
import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
	Optional,
	UnprocessableEntityException,
} from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest injection
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../../auth/entities/audit-log.entity";
import { IncidentMediaStorage } from "../../incidents/incident-media.storage";
// biome-ignore lint/style/useImportType: Nest injection
import { EventsGateway } from "../../realtime/events.gateway";
// biome-ignore lint/style/useImportType: Nest injection
import { UploadsService } from "../../uploads/uploads.service";

export interface TripImage {
	id: string;
	url: string;
	sortOrder: number;
}
export interface PreparedPendingImage {
	hash: string;
	mediaType: string;
	receiptId: string;
	upload: ReturnType<UploadsService["prepareTripImage"]>;
}
interface LockedTrip {
	host_id: string;
	status: string;
}
export const MAX_TRIP_IMAGES = 5;
export const MAX_TRIP_IMAGE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class TripImagesService {
	constructor(
		private readonly db: DataSource,
		private readonly uploads: UploadsService,
		@Optional() private readonly eventsGateway?: EventsGateway
	) {}

	async preparePendingUpdate(
		hostId: string,
		tripId: string,
		files: Express.Multer.File[],
		retainedCount: number
	): Promise<PreparedPendingImage[]> {
		await this.authorize(this.db.manager, hostId, tripId, false, true);
		if (retainedCount + files.length > MAX_TRIP_IMAGES)
			throw new UnprocessableEntityException("A Trip can contain at most 5 images");
		const validated = files.map((file) => {
			const signature = new IncidentMediaStorage().detectImage(file.buffer);
			if (
				!signature ||
				signature.contentType !== file.mimetype ||
				file.buffer.length > MAX_TRIP_IMAGE_BYTES
			)
				throw new UnprocessableEntityException("Use a JPG, PNG or WebP image up to 5 MB");
			return {
				file,
				mediaType: signature.contentType,
				hash: createHash("sha256").update(file.buffer).digest("hex"),
			};
		});
		const result: PreparedPendingImage[] = [];
		try {
			for (const item of validated) {
				const upload = this.uploads.prepareTripImage(item.file);
				const rows: { id: string }[] = await this.db.query(
					"INSERT INTO trip_image_cleanup(url,storage_key,next_attempt_at) VALUES($1,$2,now()+interval '1 hour') RETURNING id",
					[upload.url, upload.key ?? null]
				);
				result.push({ hash: item.hash, mediaType: item.mediaType, receiptId: rows[0].id, upload });
			}
			return result;
		} catch (error) {
			await this.releasePendingUploads(result);
			throw error;
		}
	}
	async releasePendingUploads(prepared: PreparedPendingImage[]): Promise<void> {
		for (const item of prepared)
			await this.db
				.query("UPDATE trip_image_cleanup SET next_attempt_at=now() WHERE id=$1", [item.receiptId])
				.catch(() => undefined);
	}
	async applyPendingUpdate(
		m: EntityManager,
		hostId: string,
		tripId: string,
		retained: string[],
		prepared: PreparedPendingImage[]
	): Promise<void> {
		const current = await this.list(tripId, m);
		if (retained.some((id) => !current.some((image) => image.id === id)))
			throw new ConflictException("Trip images changed. Reload before applying changes.");
		await m.query("DELETE FROM trip_images WHERE trip_id=$1 AND NOT(id=ANY($2::uuid[]))", [
			tripId,
			retained,
		]);
		// Move old sort indexes out of the target range before applying the retained order.
		await m.query("UPDATE trip_images SET sort_order=sort_order+100 WHERE trip_id=$1", [tripId]);
		for (const [index, id] of retained.entries())
			await m.query("UPDATE trip_images SET sort_order=$2 WHERE id=$1", [id, index]);
		let index = retained.length;
		for (const item of prepared) {
			const duplicate: { id: string }[] = await m.query(
				"SELECT id FROM trip_images WHERE trip_id=$1 AND content_hash=$2",
				[tripId, item.hash]
			);
			if (!duplicate.length) {
				const reservation: { id: string }[] = await m.query(
					"SELECT id FROM trip_image_cleanup WHERE id=$1 FOR UPDATE",
					[item.receiptId]
				);
				if (!reservation.length)
					throw new ConflictException("Upload reservation expired; retry the update");
				const stored = await item.upload.upload();
				await m.query(
					"INSERT INTO trip_images(trip_id,url,storage_key,content_hash,media_type,sort_order) VALUES($1,$2,$3,$4,$5,$6)",
					[tripId, stored.url, stored.key ?? null, item.hash, item.mediaType, index++]
				);
			}
			await m.query("DELETE FROM trip_image_cleanup WHERE id=$1", [item.receiptId]);
		}
		await m.query(
			"UPDATE trips SET cover_image_url=(SELECT url FROM trip_images WHERE trip_id=$1 ORDER BY sort_order LIMIT 1) WHERE id=$1",
			[tripId]
		);
		await m.getRepository(AuditLog).save({
			actorId: hostId,
			action: "trip.images_updated",
			targetType: "trip",
			targetId: tripId,
			before: { imageIds: current.map((i) => i.id) },
			after: { retainedImageIds: retained, uploadedCount: prepared.length },
			reason: "host_finalize_pending_trip_update",
		});
	}

	private async notifyPendingReview(tripId: string): Promise<void> {
		if (!this.eventsGateway) return;
		// The mutation is committed; notification failure must not report a failed write.
		try {
			const rows: {
				id: string;
				host_id: string;
				title: string;
				status: string;
				updated_at: Date;
			}[] = await this.db.query(
				"SELECT id,host_id,title,status,updated_at FROM trips WHERE id=$1",
				[tripId]
			);
			const trip = rows[0];
			if (trip?.status === "pending_approval")
				this.eventsGateway.emitTripReviewUpdated({
					tripId: trip.id,
					hostId: trip.host_id,
					title: trip.title,
					updatedAt: new Date(trip.updated_at).toISOString(),
				});
		} catch {
			/* Admin refresh also reconciles committed changes after reconnect. */
		}
	}
	private touchVersion(m: EntityManager, tripId: string): Promise<unknown> {
		return m.query(
			"UPDATE trips SET updated_at=GREATEST(date_trunc('milliseconds',clock_timestamp()),updated_at+interval '1 millisecond') WHERE id=$1",
			[tripId]
		);
	}

	async list(tripId: string, manager: EntityManager = this.db.manager): Promise<TripImage[]> {
		return manager.query(
			'SELECT id,url,sort_order AS "sortOrder" FROM trip_images WHERE trip_id=$1 ORDER BY sort_order',
			[tripId]
		);
	}
	private async authorize(
		m: EntityManager,
		hostId: string,
		tripId: string,
		lock = true,
		allowPendingUpdate = false
	): Promise<void> {
		const [trip]: LockedTrip[] = await m.query(
			`SELECT host_id,status FROM trips WHERE id=$1${lock ? " FOR UPDATE" : ""}`,
			[tripId]
		);
		if (!trip) throw new NotFoundException("Trip not found");
		if (trip.host_id !== hostId)
			throw new ForbiddenException("Only the owning Host can manage Trip images");
		if (trip.status === "pending_approval" && !allowPendingUpdate)
			throw new ConflictException(
				"Pending Trip image changes must be applied through Finish Update"
			);
		if (["ongoing", "completed", "cancelled"].includes(trip.status))
			throw new ConflictException("Trip images cannot be modified in this state");
	}
	async add(hostId: string, tripId: string, file?: Express.Multer.File): Promise<TripImage[]> {
		const signature = file && new IncidentMediaStorage().detectImage(file.buffer);
		if (
			!file ||
			!signature ||
			file.mimetype !== signature.contentType ||
			file.buffer.length > MAX_TRIP_IMAGE_BYTES
		) {
			throw new UnprocessableEntityException("Use a JPG, PNG or WebP image up to 5 MB");
		}
		const hash = createHash("sha256").update(file.buffer).digest("hex");
		// Upload under the Trip row lock: concurrent requests cannot exceed the limit or upload a duplicate.
		await this.authorize(this.db.manager, hostId, tripId, false);
		const prepared = this.uploads.prepareTripImage(file);
		// Commit the receipt before opening the mutation transaction, so no extra connection is needed under the Trip lock.
		const [receipt]: { id: string }[] = await this.db.query(
			"INSERT INTO trip_image_cleanup(url,storage_key,next_attempt_at) VALUES($1,$2,now()+interval '1 hour') RETURNING id",
			[prepared.url, prepared.key ?? null]
		);
		const cleanupId = receipt.id;
		let changed = false;
		try {
			const result = await this.db.transaction(async (m) => {
				await this.authorize(m, hostId, tripId);
				const images = await this.list(tripId, m);
				const duplicate: { id: string }[] = await m.query(
					"SELECT id FROM trip_images WHERE trip_id=$1 AND content_hash=$2",
					[tripId, hash]
				);
				if (duplicate.length) {
					await m.query("DELETE FROM trip_image_cleanup WHERE id=$1", [cleanupId]);
					return images;
				}
				if (images.length >= MAX_TRIP_IMAGES)
					throw new ConflictException("A Trip can contain at most 5 images");
				const reservation: { id: string }[] = await m.query(
					"SELECT id FROM trip_image_cleanup WHERE id=$1 FOR UPDATE",
					[cleanupId]
				);
				if (!reservation.length)
					throw new ConflictException("Upload reservation expired; retry the upload");
				const stored = await prepared.upload();
				await m.query(
					`INSERT INTO trip_images(trip_id,url,storage_key,content_hash,media_type,sort_order)
     VALUES($1,$2,$3,$4,$5,$6)`,
					[
						tripId,
						stored.url,
						stored.key ?? null,
						hash,
						signature.contentType,
						images.length ? Math.max(...images.map((i) => i.sortOrder)) + 1 : 0,
					]
				);
				await this.touchVersion(m, tripId);
				changed = true;
				if (!images.length)
					await m.query("UPDATE trips SET cover_image_url=$2 WHERE id=$1", [tripId, stored.url]);
				await m.getRepository(AuditLog).save({
					actorId: hostId,
					action: "trip.image_added",
					targetType: "trip",
					targetId: tripId,
					after: { contentHash: hash },
					reason: "host_manage_trip_images",
				});
				await m.query("DELETE FROM trip_image_cleanup WHERE id=$1", [cleanupId]);
				return this.list(tripId, m);
			});
			if (changed) await this.notifyPendingReview(tripId);
			return result;
		} catch (error) {
			if (cleanupId) {
				// Best effort acceleration; the independently committed receipt remains if the DB is unavailable.
				await this.db
					.query("UPDATE trip_image_cleanup SET next_attempt_at=now() WHERE id=$1", [cleanupId])
					.catch(() => undefined);
			}
			throw error;
		}
	}
	async remove(hostId: string, tripId: string, imageId: string): Promise<TripImage[]> {
		let changed = false;
		const result = await this.db.transaction(async (m) => {
			await this.authorize(m, hostId, tripId);
			const deleted: { id: string }[] = await m.query(
				"WITH removed AS (DELETE FROM trip_images WHERE trip_id=$1 AND id=$2 RETURNING id) SELECT id FROM removed",
				[tripId, imageId]
			);
			if (!deleted.length) {
				const foreign: { trip_id: string }[] = await m.query(
					"SELECT trip_id FROM trip_images WHERE id=$1",
					[imageId]
				);
				if (foreign.length) throw new NotFoundException("Image does not belong to this Trip");
			}

			if (deleted.length) {
				await this.touchVersion(m, tripId);
				changed = true;
			}
			if (deleted.length)
				await m.getRepository(AuditLog).save({
					actorId: hostId,
					action: "trip.image_removed",
					targetType: "trip",
					targetId: tripId,
					before: { imageId },
					reason: "host_manage_trip_images",
				});
			return this.list(tripId, m);
		});
		if (changed) await this.notifyPendingReview(tripId);
		return result;
	}
}
