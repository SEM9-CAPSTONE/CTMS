import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type {
	AdminGetCertificatesQuery,
	AdminRejectCertificateInput,
	CreatePorterCertificateInput,
	PorterCertificateItem,
	PorterCertificateStatus,
	PorterCertificateType,
	UpdatePorterCertificateInput,
} from "../types";

export interface BackendCertificateDto {
	id: string;
	porterId: string;
	type?: PorterCertificateType;
	certificateType?: PorterCertificateType;
	name: string;
	certificateNumber?: string | null;
	issuedBy?: string | null;
	issuedDate?: string | null;
	issueDate?: string | null;
	expiryDate?: string | null;
	fileUrl?: string | null;
	status: PorterCertificateStatus;
	rejectionReason?: string | null;
	verifiedBy?: string | null;
	verifiedAt?: string | null;
	isExpired?: boolean;
	createdAt: string | Date;
	updatedAt: string | Date;
	porterName?: string | null;
	porterEmail?: string | null;
	porterAvatarUrl?: string | null;
	porter?: {
		id: string;
		fullName: string;
		email: string;
		phone?: string;
	};
}

export function mapBackendDtoToItem(dto: BackendCertificateDto): PorterCertificateItem {
	const type = (dto.type || dto.certificateType || "other") as PorterCertificateType;
	const issuedDate = dto.issuedDate || dto.issueDate || null;
	const isExpired =
		dto.isExpired !== undefined
			? Boolean(dto.isExpired)
			: dto.expiryDate
				? new Date(dto.expiryDate) < new Date()
				: false;

	return {
		id: dto.id,
		porterId: dto.porterId,
		type,
		certificateType: type,
		name: dto.name,
		certificateNumber: dto.certificateNumber ?? null,
		issuedBy: dto.issuedBy ?? "",
		issuedDate,
		issueDate: issuedDate,
		expiryDate: dto.expiryDate ?? "",
		fileUrl: dto.fileUrl ?? "",
		status: dto.status,
		rejectionReason: dto.rejectionReason ?? null,
		verifiedBy: dto.verifiedBy ?? null,
		verifiedAt: dto.verifiedAt ?? null,
		createdAt: String(dto.createdAt),
		updatedAt: String(dto.updatedAt),
		isExpired,
		porter: dto.porter
			? {
					id: dto.porter.id || dto.porterId,
					fullName: dto.porter.fullName || dto.porterName || "",
					email: dto.porter.email || dto.porterEmail || "",
					phone: dto.porter.phone,
				}
			: dto.porterName
				? {
						id: dto.porterId,
						fullName: dto.porterName,
						email: dto.porterEmail || "",
					}
				: undefined,
	};
}

export const porterCertificatesService = {
	// Upload File
	uploadCertificateFile: async (file: File): Promise<string> => {
		const formData = new FormData();
		formData.append("file", file);
		const res = await httpClient.post<{ fileUrl: string }>(
			API_ENDPOINTS.PORTER_CERTIFICATES.UPLOAD,
			formData
		);
		return res.fileUrl;
	},

	// Porter APIs
	getMyCertificates: async (): Promise<PorterCertificateItem[]> => {
		const res = await httpClient.get<BackendCertificateDto[]>(
			API_ENDPOINTS.PORTER_CERTIFICATES.MINE
		);
		return (res || []).map(mapBackendDtoToItem);
	},

	getCertificateDetail: async (id: string): Promise<PorterCertificateItem> => {
		const res = await httpClient.get<BackendCertificateDto>(
			API_ENDPOINTS.PORTER_CERTIFICATES.DETAIL(id)
		);
		return mapBackendDtoToItem(res);
	},

	createCertificate: async (
		input: CreatePorterCertificateInput
	): Promise<PorterCertificateItem> => {
		let fileUrl = input.fileUrl;
		if (input.file) {
			fileUrl = await porterCertificatesService.uploadCertificateFile(input.file);
		}

		const body = {
			type: input.type || input.certificateType,
			name: input.name,
			certificateNumber: input.certificateNumber?.trim() || undefined,
			issuedBy: input.issuedBy?.trim() || undefined,
			issuedDate: input.issuedDate || input.issueDate || undefined,
			expiryDate: input.expiryDate,
			fileUrl: fileUrl || undefined,
		};

		const res = await httpClient.post<BackendCertificateDto>(
			API_ENDPOINTS.PORTER_CERTIFICATES.CREATE,
			body
		);
		return mapBackendDtoToItem(res);
	},

	updateCertificate: async (
		id: string,
		input: UpdatePorterCertificateInput
	): Promise<PorterCertificateItem> => {
		let fileUrl = input.fileUrl;
		if (input.file) {
			fileUrl = await porterCertificatesService.uploadCertificateFile(input.file);
		}

		const body = {
			type: input.type || input.certificateType,
			name: input.name,
			certificateNumber:
				input.certificateNumber !== undefined ? input.certificateNumber : undefined,
			issuedBy: input.issuedBy,
			issuedDate: input.issuedDate || input.issueDate || undefined,
			expiryDate: input.expiryDate,
			fileUrl: fileUrl,
		};

		const res = await httpClient.put<BackendCertificateDto>(
			API_ENDPOINTS.PORTER_CERTIFICATES.UPDATE(id),
			body
		);
		return mapBackendDtoToItem(res);
	},

	deleteCertificate: (id: string): Promise<{ success: boolean; message: string }> =>
		httpClient.delete<{ success: boolean; message: string }>(
			API_ENDPOINTS.PORTER_CERTIFICATES.DELETE(id)
		),

	// Admin APIs
	adminGetCertificates: async (
		query: AdminGetCertificatesQuery = {}
	): Promise<PorterCertificateItem[]> => {
		const raw = await httpClient.get<BackendCertificateDto[]>(
			API_ENDPOINTS.ADMIN_PORTER_CERTIFICATES.LIST,
			query.status ? { status: query.status } : undefined
		);
		return (raw || []).map(mapBackendDtoToItem);
	},

	adminVerifyCertificate: async (id: string): Promise<PorterCertificateItem> => {
		const res = await httpClient.patch<BackendCertificateDto>(
			API_ENDPOINTS.ADMIN_PORTER_CERTIFICATES.VERIFY(id)
		);
		return mapBackendDtoToItem(res);
	},

	adminRejectCertificate: async (
		id: string,
		input: AdminRejectCertificateInput
	): Promise<PorterCertificateItem> => {
		const res = await httpClient.patch<BackendCertificateDto>(
			API_ENDPOINTS.ADMIN_PORTER_CERTIFICATES.REJECT(id),
			input
		);
		return mapBackendDtoToItem(res);
	},
};
