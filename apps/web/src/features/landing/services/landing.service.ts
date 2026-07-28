import { FEATURED_DESTINATIONS } from "../constants";
import type { ChatMessage, DestinationCard } from "../types";

export const landingService = {
	getFeaturedDestinations: async (): Promise<DestinationCard[]> => {
		return Promise.resolve(FEATURED_DESTINATIONS);
	},

	sendAiQuery: async (userMessage: string): Promise<ChatMessage> => {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({
					sender: "ai",
					text: `Trợ lý CTMS: Cảm ơn bạn. Để xử lý tình huống "${userMessage}", hãy giữ bình tĩnh, kiểm tra tọa độ GPS trên ứng dụng CTMS và thực hiện theo quy trình an toàn chuẩn.`,
				});
			}, 400);
		});
	},
};
