import { API_ENDPOINTS, httpClient } from "../../../core/api";
import type { GuideCard, PorterVerification, PorterVerificationDocument } from "../types";

export const porterVerificationService = {
	getMine: (): Promise<PorterVerification> =>
		httpClient.get<PorterVerification>(API_ENDPOINTS.PORTER.VERIFICATION),

	uploadDocument: (file: File): Promise<PorterVerificationDocument> => {
		const formData = new FormData();
		formData.append("file", file);
		return httpClient.post<PorterVerificationDocument>(
			API_ENDPOINTS.PORTER.VERIFICATION_DOCUMENTS,
			formData
		);
	},

	deleteDocument: (documentId: string): Promise<void> =>
		httpClient.delete<void>(API_ENDPOINTS.PORTER.VERIFICATION_DOCUMENT(documentId)),

	updateGuideCard: (card: GuideCard): Promise<PorterVerification> =>
		httpClient.put<PorterVerification>(API_ENDPOINTS.PORTER.VERIFICATION_CARD, card),

	submit: (): Promise<PorterVerification> =>
		httpClient.post<PorterVerification>(API_ENDPOINTS.PORTER.VERIFICATION_SUBMIT),
};
