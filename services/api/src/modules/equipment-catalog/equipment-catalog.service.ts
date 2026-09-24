import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { DataSource, type EntityManager } from "typeorm";
import { AuditLog } from "../auth/entities/audit-log.entity";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { UserRole } from "../users/entities/user.entity";
import type { CreateEquipmentCatalogItemDto } from "./dto/create-equipment-catalog-item.dto";
import {
	type EquipmentCatalogItemResponseDto,
	toEquipmentCatalogItemResponse,
} from "./dto/equipment-catalog-item-response.dto";
import type { UpdateEquipmentCatalogItemDto } from "./dto/update-equipment-catalog-item.dto";
import type { EquipmentCatalogItem } from "./entities/equipment-catalog-item.entity";
// biome-ignore lint/style/useImportType: Nest runtime injection metadata
import { EquipmentCatalogRepository } from "./equipment-catalog.repository";

function snapshot(item: EquipmentCatalogItem): Record<string, unknown> {
	return {
		name: item.name,
		category: item.category,
		quantityTotal: item.quantityTotal,
		rentalPricePerDay: item.rentalPricePerDay,
		status: item.status,
		maintenanceSchedule: item.maintenanceSchedule,
	};
}

/**
 * CTMS-039-T01. Host-owned equipment catalog CRUD. Deliberately does not
 * touch `equipment_reservations`/availability math -- that is CTMS-40/41's
 * job, which reads this table but is not built here (both are still
 * blocked on unbuilt dependencies as of this story).
 */
@Injectable()
export class EquipmentCatalogService {
	constructor(
		private readonly items: EquipmentCatalogRepository,
		private readonly dataSource: DataSource
	) {}

	async create(
		hostId: string,
		dto: CreateEquipmentCatalogItemDto
	): Promise<EquipmentCatalogItemResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const items = manager.withRepository(this.items);
			const created = items.create({
				hostId,
				name: dto.name,
				category: dto.category,
				quantityTotal: dto.quantityTotal,
				rentalPricePerDay: dto.rentalPricePerDay,
				maintenanceSchedule: dto.maintenanceSchedule ?? null,
			});
			const saved = await items.save(created);

			await manager.getRepository(AuditLog).save({
				actorId: hostId,
				action: "equipment_catalog_item.created",
				targetType: "equipment_catalog_item",
				targetId: saved.id,
				before: null,
				after: snapshot(saved),
				reason: null,
			});

			return toEquipmentCatalogItemResponse(saved);
		});
	}

	async listMine(hostId: string): Promise<EquipmentCatalogItemResponseDto[]> {
		const items = await this.items.findMineByHost(hostId);
		return items.map(toEquipmentCatalogItemResponse);
	}

	async getItem(
		actor: AuthenticatedUser,
		itemId: string
	): Promise<EquipmentCatalogItemResponseDto> {
		const item = await this.items.findOneBy({ id: itemId });
		if (!item) {
			throw new NotFoundException("Equipment catalog item not found");
		}
		this.assertOwnerOrAdmin(actor, item.hostId);
		return toEquipmentCatalogItemResponse(item);
	}

	async update(
		actor: AuthenticatedUser,
		itemId: string,
		dto: UpdateEquipmentCatalogItemDto
	): Promise<EquipmentCatalogItemResponseDto> {
		return this.dataSource.transaction(async (manager: EntityManager) => {
			const items = manager.withRepository(this.items);
			const item = await items.findForUpdate(itemId);
			if (!item) {
				throw new NotFoundException("Equipment catalog item not found");
			}
			this.assertOwnerOrAdmin(actor, item.hostId);

			const before = snapshot(item);
			if (dto.name !== undefined) item.name = dto.name;
			if (dto.category !== undefined) item.category = dto.category;
			if (dto.quantityTotal !== undefined) item.quantityTotal = dto.quantityTotal;
			if (dto.rentalPricePerDay !== undefined) item.rentalPricePerDay = dto.rentalPricePerDay;
			if (dto.status !== undefined) item.status = dto.status;
			if (dto.maintenanceSchedule !== undefined) item.maintenanceSchedule = dto.maintenanceSchedule;

			const saved = await items.save(item);

			await manager.getRepository(AuditLog).save({
				actorId: actor.userId,
				action: "equipment_catalog_item.updated",
				targetType: "equipment_catalog_item",
				targetId: saved.id,
				before,
				after: snapshot(saved),
				reason: null,
			});

			return toEquipmentCatalogItemResponse(saved);
		});
	}

	private assertOwnerOrAdmin(actor: AuthenticatedUser, ownerHostId: string): void {
		if (actor.roles.includes(UserRole.ADMIN)) return;
		if (actor.userId !== ownerHostId) {
			throw new ForbiddenException("Only the owning Host can access this equipment catalog item");
		}
	}
}
