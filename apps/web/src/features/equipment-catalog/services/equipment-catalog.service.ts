import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	CreateEquipmentCatalogItemInput,
	EquipmentCatalogItem,
	UpdateEquipmentCatalogItemInput,
} from "../types";

export const equipmentCatalogService = {
	listMine: (): Promise<EquipmentCatalogItem[]> =>
		httpClient.get<EquipmentCatalogItem[]>(API_ENDPOINTS.EQUIPMENT_CATALOG.MINE),
	create: (input: CreateEquipmentCatalogItemInput): Promise<EquipmentCatalogItem> =>
		httpClient.post<EquipmentCatalogItem>(API_ENDPOINTS.EQUIPMENT_CATALOG.CREATE, input),
	getById: (itemId: string): Promise<EquipmentCatalogItem> =>
		httpClient.get<EquipmentCatalogItem>(API_ENDPOINTS.EQUIPMENT_CATALOG.DETAIL(itemId)),
	update: (itemId: string, input: UpdateEquipmentCatalogItemInput): Promise<EquipmentCatalogItem> =>
		httpClient.patch<EquipmentCatalogItem>(API_ENDPOINTS.EQUIPMENT_CATALOG.DETAIL(itemId), input),
};
